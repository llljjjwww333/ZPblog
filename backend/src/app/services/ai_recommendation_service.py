"""
AI 智能推荐服务 - 使用大语言模型增强推荐效果
"""
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
import json
import os

from app.model.post import Post
from app.model.user import User
from app.model.category import Category
from app.model.user_behavior import UserBehavior, UserPreference
from app.config import settings


class AIRecommendationService:
    """AI 推荐服务类"""
    
    def __init__(self, db: Session, provider_id: str = None, user_id: int = None):
        self.db = db
        self.user_id = user_id
        self.provider_id = provider_id or settings.AI_PROVIDER  # 支持动态选择模型
        self.is_user_config = False  # 是否是用户自定义配置
        
        # 检查是否是用户自定义模型（以"user_"开头）
        if self.provider_id and self.provider_id.startswith('user_'):
            self._load_user_config()
        else:
            # 从系统LLM配置中获取
            self._load_system_config()
    
    def _load_user_config(self):
        """加载用户自定义模型配置"""
        from app.model.user_llm_config import UserLLMConfig
        from app.core.encryption import get_encryption
        
        # 提取实际的provider_id（去掉"user_"前缀）
        actual_provider_id = self.provider_id[5:]  # 去掉 "user_"
        
        # 查询用户配置
        user_config = self.db.query(UserLLMConfig).filter(
            UserLLMConfig.user_id == self.user_id,
            UserLLMConfig.provider_id == actual_provider_id,
            UserLLMConfig.is_active == True
        ).first()
        
        if user_config:
            # 解密API密钥
            encryption = get_encryption()
            try:
                self.api_key = encryption.decrypt(user_config.api_key)
                self.api_base = user_config.base_url
                self.model = user_config.model_name
                self.ai_provider = 'openai'
                self.is_user_config = True
                
                # 更新使用统计
                user_config.usage_count += 1
                user_config.last_used_at = datetime.now()
                self.db.commit()
                
                print(f"[DEBUG] 使用用户自定义模型: {user_config.name}")
            except Exception as e:
                print(f"[ERROR] 解密用户API密钥失败: {e}")
                # 回退到系统配置
                self._load_system_config()
        else:
            print(f"[WARN] 未找到用户自定义模型配置: {actual_provider_id}")
            # 回退到系统配置
            self._load_system_config()
    
    def _load_system_config(self):
        """加载系统预设模型配置"""
        from app.core.llm_config import get_llm_config
        llm_config = get_llm_config()
        
        provider_config = llm_config.get_provider(self.provider_id)
        if provider_config:
            self.api_key = provider_config.api_key
            self.api_base = provider_config.base_url
            self.model = provider_config.model
            self.ai_provider = 'openai'
        else:
            # 回退到默认配置
            self.ai_provider = settings.AI_PROVIDER
            self.api_key = settings.AI_API_KEY
            self.api_base = settings.AI_API_BASE
            self.model = settings.AI_MODEL
    
    def get_ai_recommendations(
        self, 
        user_id: Optional[int] = None, 
        limit: int = 10,
        context: str = "",
        model: str = None
    ) -> Tuple[List[Post], str]:
        """
        使用 AI 生成智能推荐（支持反馈闭环）
        
        Args:
            user_id: 用户ID
            limit: 返回数量
            context: 额外的上下文信息
            model: 使用的AI模型提供商ID (deepseek/qwen/openai等)
        
        Returns:
            (推荐文章列表, AI推荐理由)
        """
        print(f"[DEBUG] get_ai_recommendations 被调用: user_id={user_id}, limit={limit}, model={model}")
        
        # 如果指定了模型，重新初始化配置
        if model and model != self.provider_id:
            from app.core.llm_config import get_llm_config
            llm_config = get_llm_config()
            provider_config = llm_config.get_provider(model)
            if provider_config:
                self.provider_id = model
                self.api_key = provider_config.api_key
                self.api_base = provider_config.base_url
                self.model = provider_config.model
                print(f"[DEBUG] 切换到模型: {model}, base_url: {self.api_base}")
        
        try:
            # 获取用户画像
            user_profile = self._get_user_profile(user_id)
            print(f"[DEBUG] 用户画像: {user_profile}")
            
            # 获取候选文章
            candidate_posts = self._get_candidate_posts(user_id, limit * 3)
            print(f"[DEBUG] 候选文章数量: {len(candidate_posts)}")
            
            if not candidate_posts:
                # 如果没有候选文章，返回热门文章
                from app.services.recommendation_service import RecommendationService
                service = RecommendationService(self.db)
                return service.get_popular_posts(limit), "基于热门度推荐"
            
            # 获取用户负向偏好（反馈闭环）
            negative_preferences = None
            skipped_posts = None
            if user_id:
                from app.services.feedback_service import FeedbackService
                feedback_service = FeedbackService(self.db)
                negative_preferences = feedback_service.get_negative_preferences(user_id)
                skipped_posts = feedback_service.get_recent_skipped_posts(user_id)
            
            # 构建 AI 提示词（加入负样本）
            prompt = self._build_recommendation_prompt(
                user_profile, 
                candidate_posts, 
                limit,
                context,
                negative_preferences=negative_preferences,
                skipped_posts=skipped_posts
            )
            
            # 调用 AI 模型
            ai_response = self._call_ai_model(prompt)
            
            # 解析 AI 响应
            recommended_ids, reason = self._parse_ai_response(ai_response)
            
            # 获取推荐的文章
            if recommended_ids:
                posts = self.db.query(Post).filter(
                    Post.id.in_(recommended_ids),
                    Post.status == 'published'
                ).all()
                # 按照 AI 推荐的顺序排序
                post_map = {p.id: p for p in posts}
                sorted_posts = [post_map[id] for id in recommended_ids if id in post_map]
                
                # 如果 AI 推荐的文章不够，补充热门文章
                if len(sorted_posts) < limit:
                    existing_ids = [p.id for p in sorted_posts]
                    additional = self.db.query(Post).filter(
                        Post.status == 'published',
                        ~Post.id.in_(existing_ids)
                    ).order_by(desc(Post.view_count)).limit(limit - len(sorted_posts)).all()
                    sorted_posts.extend(additional)
                
                return sorted_posts[:limit], reason
            else:
                # AI 解析失败，返回前几个候选文章
                return candidate_posts[:limit], "基于您的阅读历史推荐"
                
        except Exception as e:
            print(f"AI 推荐失败: {e}")
            # 失败时回退到传统推荐
            from app.services.recommendation_service import RecommendationService
            service = RecommendationService(self.db)
            return service.get_hybrid_recommendations(user_id, limit), "基于热门和相似度推荐"
    
    def _get_user_profile(self, user_id: Optional[int]) -> Dict:
        """获取用户画像"""
        if not user_id:
            return {"type": "新用户", "interests": [], "history": []}
        
        # 获取用户偏好分类
        preferences = self.db.query(
            Category.name,
            UserPreference.preference_score
        ).join(
            UserPreference,
            UserPreference.category_id == Category.id
        ).filter(
            UserPreference.user_id == user_id
        ).order_by(
            desc(UserPreference.preference_score)
        ).limit(5).all()
        
        # 获取用户最近阅读的文章
        recent_behaviors = self.db.query(
            Post.title,
            Post.excerpt,
            Category.name.label('category_name'),
            UserBehavior.behavior_type
        ).join(
            Post,
            Post.id == UserBehavior.post_id
        ).outerjoin(
            Category,
            Category.id == Post.category_id
        ).filter(
            UserBehavior.user_id == user_id
        ).order_by(
            desc(UserBehavior.created_at)
        ).limit(10).all()
        
        return {
            "type": "老用户",
            "interests": [{"category": p[0], "score": p[1]} for p in preferences],
            "history": [
                {
                    "title": b[0][:50] if b[0] else "",
                    "excerpt": b[1][:100] if b[1] else "",
                    "category": b[2] or "未分类",
                    "behavior": b[3]
                }
                for b in recent_behaviors
            ]
        }
    
    def _get_candidate_posts(self, user_id: Optional[int], limit: int = 30) -> List[Post]:
        """获取候选文章"""
        print(f"[DEBUG] _get_candidate_posts: user_id={user_id}, limit={limit}")
        
        # 获取用户已阅读的文章ID
        read_post_ids = []
        if user_id:
            read_post_ids = [
                b[0] for b in self.db.query(UserBehavior.post_id).filter(
                    UserBehavior.user_id == user_id
                ).all()
            ]
            print(f"[DEBUG] 用户已阅读文章数量: {len(read_post_ids)}")
        
        # 获取候选文章（排除已阅读的）
        query = self.db.query(Post).filter(
            Post.status == 'published'
        )
        
        if read_post_ids:
            query = query.filter(~Post.id.in_(read_post_ids))
        
        # 优先获取近期文章和热门文章
        posts = query.order_by(
            desc(Post.created_at),
            desc(Post.view_count)
        ).limit(limit).all()
        
        print(f"[DEBUG] 查询到的候选文章数量: {len(posts)}")
        if posts:
            print(f"[DEBUG] 第一篇文章: {posts[0].title}")
        
        return posts
    
    def _build_recommendation_prompt(
        self, 
        user_profile: Dict, 
        candidate_posts: List[Post],
        limit: int,
        context: str,
        negative_preferences: Dict = None,
        skipped_posts: List[Dict] = None
    ) -> str:
        """构建 AI 推荐提示词（支持负样本反馈）"""
        
        # 构建用户画像描述
        if user_profile["type"] == "新用户":
            user_desc = "这是一个新用户，还没有阅读历史。"
        else:
            interests = ", ".join([f"{i['category']}({i['score']:.1f})" for i in user_profile["interests"]])
            user_desc = f"用户偏好分类: {interests}\n"
            
            if user_profile["history"]:
                history_desc = "\n最近阅读历史:\n"
                for i, h in enumerate(user_profile["history"][:5], 1):
                    history_desc += f"{i}. [{h['behavior']}] {h['title']} ({h['category']})\n"
                user_desc += history_desc
        
        # 构建候选文章描述
        posts_desc = "\n候选文章列表:\n"
        for i, post in enumerate(candidate_posts, 1):
            category_name = post.category.name if post.category else "未分类"
            excerpt = post.excerpt[:80] if post.excerpt else ""
            posts_desc += f"{i}. ID:{post.id} | {post.title} | 分类:{category_name} | 阅读量:{post.view_count}\n   摘要:{excerpt}\n\n"
        
        # 添加上下文
        context_desc = f"\n额外上下文: {context}\n" if context else ""
        
        # 构建负向偏好提示（反馈闭环核心）
        negative_desc = ""
        if negative_preferences:
            negative_categories = negative_preferences.get("categories", [])
            negative_keywords = negative_preferences.get("keywords", [])
            
            if negative_categories or negative_keywords:
                negative_desc = "\n【重要：用户负向偏好反馈】\n"
                negative_desc += "根据用户之前的反馈，以下类型的内容用户不太感兴趣，请避免推荐：\n"
                
                if negative_categories:
                    negative_desc += f"- 跳过的分类: {', '.join([f'{c[0]}({c[1]}次)' for c in negative_categories[:3]])}\n"
                
                if negative_keywords:
                    negative_desc += f"- 不感兴趣的关键词: {', '.join([f'{k[0]}({k[1]}次)' for k in negative_keywords[:3]])}\n"
                
                negative_desc += "\n请调整推荐策略，减少推荐上述类型的内容。\n"
        
        # 添加最近跳过的文章示例
        skipped_desc = ""
        if skipped_posts and len(skipped_posts) > 0:
            skipped_desc = "\n【用户最近跳过的文章示例】\n"
            for i, post in enumerate(skipped_posts[:3], 1):
                skipped_desc += f"{i}. 《{post['title']}》(分类: {post['category']})\n"
            skipped_desc += "\n注意：类似上述被用户跳过的文章类型，请减少推荐。\n"
        
        prompt = f"""你是一个智能文章推荐助手。请根据用户画像和候选文章，为用户推荐最相关的 {limit} 篇文章。

{user_desc}
{posts_desc}
{context_desc}
{negative_desc}
{skipped_desc}
请分析用户的兴趣偏好，从候选文章中选择最合适的 {limit} 篇，并给出推荐理由。

请以 JSON 格式返回，格式如下:
{{
    "recommended_ids": [文章ID列表],
    "reason": "推荐理由，简要说明为什么推荐这些文章"
}}

注意:
1. 只返回 JSON，不要返回其他内容
2. 推荐的文章ID必须从候选文章中选择
3. 考虑用户的阅读偏好、文章热度、内容多样性
4. 【重要】参考用户的负向偏好反馈，避免推荐用户不感兴趣的内容类型
5. 推荐理由要简洁明了
"""
        return prompt
    
    def _call_ai_model(self, prompt: str) -> str:
        """调用 AI 模型"""
        try:
            if self.ai_provider == 'openai':
                return self._call_openai(prompt)
            elif self.ai_provider == 'azure':
                return self._call_azure_openai(prompt)
            elif self.ai_provider == 'local':
                return self._call_local_model(prompt)
            else:
                # 默认使用简单的规则推荐
                return self._rule_based_recommendation(prompt)
        except Exception as e:
            print(f"AI 调用失败: {e}")
            return self._rule_based_recommendation(prompt)
    
    def _call_openai(self, prompt: str) -> str:
        """调用 OpenAI API（带超时控制）"""
        import openai
        import httpx
        
        # 创建带超时的HTTP客户端
        timeout = httpx.Timeout(30.0, connect=10.0)
        http_client = httpx.Client(timeout=timeout)
        
        client = openai.OpenAI(
            api_key=self.api_key,
            base_url=self.api_base if self.api_base else None,
            http_client=http_client
        )
        
        try:
            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "你是一个智能文章推荐助手。"},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=1000,
                timeout=30  # 30秒超时
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"OpenAI API调用失败: {e}")
            raise
        finally:
            http_client.close()
    
    def _call_azure_openai(self, prompt: str) -> str:
        """调用 Azure OpenAI"""
        import openai
        
        client = openai.AzureOpenAI(
            api_key=self.api_key,
            api_version="2024-02-01",
            azure_endpoint=self.api_base
        )
        
        response = client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "你是一个智能文章推荐助手。"},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=1000
        )
        
        return response.choices[0].message.content
    
    def _call_local_model(self, prompt: str) -> str:
        """调用本地模型（如 Ollama）"""
        import requests
        
        response = requests.post(
            f"{self.api_base}/api/generate",
            json={
                "model": self.model,
                "prompt": prompt,
                "stream": False
            }
        )
        
        if response.status_code == 200:
            return response.json().get("response", "")
        else:
            raise Exception(f"本地模型调用失败: {response.status_code}")
    
    def _rule_based_recommendation(self, prompt: str) -> str:
        """基于规则的推荐（当 AI 不可用时使用）"""
        # 从提示词中提取候选文章ID
        import re
        ids = re.findall(r'ID:(\d+)', prompt)
        
        if ids:
            # 返回前几个ID
            return json.dumps({
                "recommended_ids": [int(id) for id in ids[:5]],
                "reason": "基于您的阅读历史和文章热度推荐"
            })
        else:
            return json.dumps({
                "recommended_ids": [],
                "reason": "暂无推荐"
            })
    
    def _parse_ai_response(self, response: str) -> Tuple[List[int], str]:
        """解析 AI 响应"""
        try:
            # 尝试提取 JSON
            import re
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                json_str = json_match.group()
                data = json.loads(json_str)
                
                recommended_ids = data.get("recommended_ids", [])
                reason = data.get("reason", "AI 智能推荐")
                
                return recommended_ids, reason
            else:
                return [], "解析失败"
        except Exception as e:
            print(f"解析 AI 响应失败: {e}")
            return [], "解析失败"
    
    def generate_personalized_reason(self, user_id: int, post_id: int) -> str:
        """
        生成个性化的推荐理由
        
        Args:
            user_id: 用户ID
            post_id: 文章ID
        
        Returns:
            个性化推荐理由
        """
        try:
            # 获取用户信息
            user = self.db.query(User).filter(User.id == user_id).first()
            post = self.db.query(Post).filter(Post.id == post_id).first()
            
            if not user or not post:
                return "为您推荐"
            
            # 获取用户偏好
            preferences = self.db.query(
                Category.name
            ).join(
                UserPreference,
                UserPreference.category_id == Category.id
            ).filter(
                UserPreference.user_id == user_id
            ).order_by(
                desc(UserPreference.preference_score)
            ).limit(3).all()
            
            preference_names = [p[0] for p in preferences]
            
            # 构建提示词
            prompt = f"""为用户生成个性化的推荐理由。

用户信息:
- 昵称: {user.nickname or user.username}
- 偏好分类: {', '.join(preference_names) if preference_names else '暂无'}

文章信息:
- 标题: {post.title}
- 分类: {post.category.name if post.category else '未分类'}
- 摘要: {post.excerpt[:100] if post.excerpt else ''}

请生成一句简洁的推荐理由（20字以内），说明为什么这篇文章适合该用户。
例如："根据您对技术的偏好推荐"、"与您之前阅读的文章相关"等。

只返回推荐理由，不要返回其他内容。"""
            
            reason = self._call_ai_model(prompt)
            
            # 清理响应
            reason = reason.strip().replace('"', '').replace("'", "")
            
            if len(reason) > 30:
                reason = reason[:30] + "..."
            
            return reason if reason else "为您推荐"
            
        except Exception as e:
            print(f"生成推荐理由失败: {e}")
            return "为您推荐"
