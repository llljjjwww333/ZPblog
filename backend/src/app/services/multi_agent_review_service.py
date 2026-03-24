"""
双AI讨论评审服务 - 支持DeepSeek、千问 + 用户自定义模型
实现两个不同LLM模型之间的直接讨论
"""
import re
from typing import List, Dict, Optional
from datetime import datetime
from openai import OpenAI
from app.core.llm_config import get_llm_config, LLMProviderConfig
from app.core.encryption import get_encryption


class LLMClient:
    """LLM客户端封装"""
    
    def __init__(self, provider: str, api_key: str, base_url: str, model: str, name: str = None):
        self.provider = provider
        self.model = model
        self.name = name or provider  # 显示名称
        self.client = OpenAI(
            api_key=api_key,
            base_url=base_url
        )
    
    def chat(self, system_prompt: str, user_prompt: str, temperature: float = 0.7, max_tokens: int = 2000) -> str:
        """调用LLM进行对话"""
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=temperature,
                max_tokens=max_tokens
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"[ERROR] {self.provider} API调用失败: {e}")
            return f"[{self.provider}] 调用失败: {str(e)}"


class MultiAgentReviewService:
    """双AI讨论评审服务"""
    
    def __init__(self, db_session=None):
        # 初始化LLM客户端
        self.llm_clients = {}
        self.llm_config = get_llm_config()
        self.db_session = db_session
        
        # 1. 加载系统预设的DeepSeek和千问（前两个固定）
        system_models = ['deepseek', 'qwen']
        for provider_id in system_models:
            config = self.llm_config.get_provider(provider_id)
            if config and config.api_key:
                self.llm_clients[provider_id] = LLMClient(
                    provider=provider_id,
                    api_key=config.api_key,
                    base_url=config.base_url,
                    model=config.model,
                    name=config.name
                )
                print(f"[初始化] 系统模型 {config.name} 已配置")
        
        print(f"[初始化] 系统模型加载完成，共 {len(self.llm_clients)} 个")
    
    def load_user_models(self, user_id: int, db_session):
        """
        加载用户自定义模型
        
        Args:
            user_id: 用户ID
            db_session: 数据库会话
        """
        if not user_id or not db_session:
            return
        
        try:
            from app.model.user_llm_config import UserLLMConfig
            
            # 查询用户启用的自定义模型
            user_configs = db_session.query(UserLLMConfig).filter(
                UserLLMConfig.user_id == user_id,
                UserLLMConfig.is_active == True
            ).all()
            
            encryption = get_encryption()
            
            for config in user_configs:
                try:
                    # 解密API密钥
                    api_key = encryption.decrypt(config.api_key)
                    
                    # 创建客户端
                    provider_id = f"user_{config.provider_id}"
                    self.llm_clients[provider_id] = LLMClient(
                        provider=provider_id,
                        api_key=api_key,
                        base_url=config.base_url or None,
                        model=config.model_name,
                        name=config.name
                    )
                    
                    # 更新使用统计
                    config.usage_count += 1
                    config.last_used_at = datetime.now()
                    
                    print(f"[初始化] 用户模型 {config.name} 已加载")
                except Exception as e:
                    print(f"[错误] 加载用户模型 {config.provider_id} 失败: {e}")
            
            db_session.commit()
            print(f"[初始化] 用户模型加载完成，共 {len(user_configs)} 个")
            
        except Exception as e:
            print(f"[错误] 加载用户模型失败: {e}")
    
    def get_available_llms(self, user_id: int = None, db_session=None) -> List[Dict]:
        """
        获取所有可用的LLM列表
        
        Returns:
            LLM列表，包含系统模型和用户自定义模型
        """
        # 如果需要加载用户模型
        if user_id and db_session:
            self.load_user_models(user_id, db_session)
        
        llms = []
        
        # 1. 系统预设模型（DeepSeek、千问）
        for provider_id, client in self.llm_clients.items():
            if not provider_id.startswith('user_'):
                # 确定logo
                if 'deepseek' in provider_id.lower():
                    logo_url = '/deepseek-color.svg'
                elif 'qwen' in provider_id.lower():
                    logo_url = '/qwen-color.svg'
                else:
                    logo_url = None
                
                llms.append({
                    'id': provider_id,
                    'name': client.name,
                    'logo_url': logo_url,
                    'type': 'system',
                    'is_user_config': False
                })
        
        # 2. 用户自定义模型
        for provider_id, client in self.llm_clients.items():
            if provider_id.startswith('user_'):
                # 提取原始provider_id
                original_id = provider_id[5:]  # 去掉 'user_' 前缀
                
                # 确定logo
                if original_id == 'gemini':
                    logo_url = '/gemini-color.svg'
                elif original_id == 'gpt':
                    logo_url = '/openai.svg'
                elif original_id == 'claude':
                    logo_url = '/claude-color.svg'
                else:
                    logo_url = None
                
                llms.append({
                    'id': provider_id,
                    'name': client.name,
                    'logo_url': logo_url,
                    'type': 'user',
                    'is_user_config': True
                })
        
        return llms
    
    def collaborative_review(self, title: str, content: str, 
                            custom_audience: Optional[Dict] = None,
                            selected_llms: Optional[List[str]] = None) -> List[Dict]:
        """
        双AI讨论评审
        
        流程：
        1. 两个AI分别给出初始评审意见
        2. 两个AI针对彼此的观点进行多轮讨论
        3. 最终生成综合评审报告
        """
        messages = []
        
        # 获取可用的LLM列表
        available_llms = list(self.llm_clients.keys())
        
        # 如果用户选择了特定的LLM，则使用用户选择的
        if selected_llms:
            available_llms = [llm for llm in selected_llms if llm in available_llms]
        
        # 确保至少有两个LLM参与讨论
        if len(available_llms) < 2:
            print("[错误] 至少需要两个LLM才能进行讨论")
            return messages
        
        llm_a = available_llms[0]
        llm_b = available_llms[1]
        
        # 获取LLM显示名称
        llm_a_config = self.llm_config.get_provider(llm_a)
        llm_b_config = self.llm_config.get_provider(llm_b)
        llm_a_name = llm_a_config.name if llm_a_config else llm_a.upper()
        llm_b_name = llm_b_config.name if llm_b_config else llm_b.upper()
        
        print(f"[双AI讨论] {llm_a_name} vs {llm_b_name}")
        
        # 第一阶段：两个AI分别给出初始评审
        print(f"[双AI讨论] {llm_a_name} 给出初始评审...")
        review_a = self._generate_review(
            title, content, llm_a, 
            self.llm_clients[llm_a], custom_audience
        )
        messages.append({
            'agent_name': llm_a_name,
            'agent_icon': '🤖',
            'content': review_a,
            'message_type': 'review',
            'target_agent': None,
            'confidence': 0.85,
            'phase': 'initial'
        })
        
        print(f"[双AI讨论] {llm_b_name} 给出初始评审...")
        review_b = self._generate_review(
            title, content, llm_b,
            self.llm_clients[llm_b], custom_audience
        )
        messages.append({
            'agent_name': llm_b_name,
            'agent_icon': '🤖',
            'content': review_b,
            'message_type': 'review',
            'target_agent': None,
            'confidence': 0.85,
            'phase': 'initial'
        })
        
        # 第二阶段：两个AI进行讨论
        print(f"[双AI讨论] 开始讨论阶段...")
        discussions = self._conduct_discussion(
            title, content, review_a, review_b,
            llm_a, llm_b, custom_audience
        )
        messages.extend(discussions)
        
        # 第三阶段：生成最终共识报告
        print(f"[双AI讨论] 生成共识报告...")
        consensus = self._generate_consensus(
            title, content, messages,
            self.llm_clients[llm_a], custom_audience
        )
        messages.append({
            'agent_name': '评审委员会',
            'agent_icon': '⚖️',
            'content': consensus,
            'message_type': 'consensus',
            'target_agent': None,
            'confidence': 0.9,
            'phase': 'consensus'
        })
        
        return messages
    
    def _generate_review(self, title: str, content: str,
                        llm_name: str, llm_client: LLMClient,
                        custom_audience: Optional[Dict] = None) -> str:
        """生成AI的初始评审"""
        
        # 目标读者信息
        audience_info = ""
        if custom_audience and (custom_audience.get('name') or custom_audience.get('description')):
            audience_name = custom_audience.get('name', '读者')
            audience_desc = custom_audience.get('description', '')
            audience_info = f"\n目标读者：{audience_name}\n读者描述：{audience_desc}\n"
        
        # 获取LLM显示名称
        llm_config = self.llm_config.get_provider(llm_name)
        llm_display_name = llm_config.name if llm_config else llm_name.upper()
        
        system_prompt = f"你是{llm_display_name}，一位专业的文章评审专家。请对文章进行全面、深入的评审。"
        
        user_prompt = f"""请对以下文章进行专业评审：

【文章标题】
{title}

【文章内容】
{content}

{audience_info}
请从以下几个维度进行评审：
1. 内容质量（观点是否清晰、论证是否充分）
2. 结构逻辑（文章结构是否合理、段落衔接是否流畅）
3. 语言表达（语言是否自然、有无AI痕迹、是否符合目标读者）
4. 改进建议（具体、可操作的改进方案）
5. 评分（1-10分，并说明理由）

【输出格式】
1. 总体评价（2-3句话）
2. 具体问题（列出3-5个问题，每个包含：问题描述 + 位置 + 改进建议）
3. 评分与理由
4. 优先级建议（高/中/低）

请确保评审基于文章实际内容，提出具体、可操作的建议。"""

        return llm_client.chat(system_prompt, user_prompt, temperature=0.7, max_tokens=2500)
    
    def _conduct_discussion(self, title: str, content: str,
                           review_a: str, review_b: str,
                           llm_a: str, llm_b: str,
                           custom_audience: Optional[Dict] = None) -> List[Dict]:
        """组织两个AI之间的讨论"""
        discussions = []
        
        # 获取LLM显示名称
        llm_a_config = self.llm_config.get_provider(llm_a)
        llm_b_config = self.llm_config.get_provider(llm_b)
        llm_a_name = llm_a_config.name if llm_a_config else llm_a.upper()
        llm_b_name = llm_b_config.name if llm_b_config else llm_b.upper()
        
        # 讨论轮数
        max_rounds = 3  # 每个AI发言3次，共6轮
        
        # 讨论历史
        discussion_history = [
            f"{llm_a_name}: {review_a[:500]}...",
            f"{llm_b_name}: {review_b[:500]}..."
        ]
        
        # 交替讨论
        for round_num in range(max_rounds):
            # AI A 回应
            response_a = self._generate_discussion_response(
                llm_a, self.llm_clients[llm_a],
                review_b if round_num == 0 else discussions[-1]['content'],
                discussion_history, round_num, custom_audience
            )
            discussions.append({
                'agent_name': llm_a_name,
                'agent_icon': '🤖',
                'content': response_a,
                'message_type': 'response',
                'target_agent': llm_b_name,
                'confidence': 0.8,
                'phase': 'discussion'
            })
            discussion_history.append(f"{llm_a_name}: {response_a}")
            
            # AI B 回应
            response_b = self._generate_discussion_response(
                llm_b, self.llm_clients[llm_b],
                response_a, discussion_history, round_num, custom_audience
            )
            discussions.append({
                'agent_name': llm_b_name,
                'agent_icon': '🤖',
                'content': response_b,
                'message_type': 'response',
                'target_agent': llm_a_name,
                'confidence': 0.8,
                'phase': 'discussion'
            })
            discussion_history.append(f"{llm_b_name}: {response_b}")
        
        return discussions
    
    def _generate_discussion_response(self, llm_name: str, llm_client: LLMClient,
                                     other_review: str, discussion_history: List[str],
                                     round_num: int,
                                     custom_audience: Optional[Dict] = None) -> str:
        """生成讨论回应"""
        
        # 目标读者信息
        audience_info = ""
        if custom_audience and (custom_audience.get('name') or custom_audience.get('description')):
            audience_name = custom_audience.get('name', '读者')
            audience_desc = custom_audience.get('description', '')
            audience_info = f"\n目标读者：{audience_name} - {audience_desc}\n"
        
        # 获取LLM显示名称
        llm_config = self.llm_config.get_provider(llm_name)
        llm_display_name = llm_config.name if llm_config else llm_name.upper()
        
        # 构建提示
        history_text = "\n\n".join(discussion_history[-4:])  # 只保留最近4条
        
        # 根据轮数确定策略
        if round_num == 0:
            strategy = "首次回应，针对对方的评审观点发表你的看法，可以认同、补充或提出不同意见"
        elif round_num == 1:
            strategy = "深入讨论，针对有争议的观点进行更深入的分析，提出具体的解决方案"
        else:
            strategy = "总结讨论，尝试与对方达成共识，或提出折中方案"
        
        system_prompt = f"你是{llm_display_name}，正在与另一个AI进行文章评审讨论。请基于专业角度提供建设性意见。"
        
        user_prompt = f"""{audience_info}

当前讨论进展：
{history_text}

这是第{round_num + 1}轮讨论。

任务：{strategy}

要求：
1. 基于之前的讨论内容，发表你的观点
2. 不要重复之前已经说过的内容
3. 提出具体、可操作的建议
4. 保持专业和建设性的态度
5. 如果是最后一轮，尝试总结并寻找共识

请发表你的观点（150-250字）："""

        return llm_client.chat(system_prompt, user_prompt, temperature=0.8, max_tokens=400)
    
    def _generate_consensus(self, title: str, content: str,
                           messages: List[Dict],
                           llm_client: LLMClient,
                           custom_audience: Optional[Dict] = None) -> str:
        """生成综合评审报告"""
        
        # 收集所有评审意见和讨论
        all_reviews = "\n\n".join([
            f"【{m['agent_name']}】\n{m['content']}"
            for m in messages if m['message_type'] in ['review', 'response']
        ])
        
        # 目标读者信息
        audience_info = ""
        if custom_audience and (custom_audience.get('name') or custom_audience.get('description')):
            audience_name = custom_audience.get('name', '读者')
            audience_desc = custom_audience.get('description', '')
            audience_info = f"\n目标读者：{audience_name} - {audience_desc}\n"
        
        system_prompt = "你是评审委员会主席，负责综合两个AI的评审意见生成最终报告。"
        
        user_prompt = f"""基于以下两个AI的评审意见和讨论记录，生成一份综合评审报告：

【文章标题】
{title}

【文章内容摘要】
{content[:500]}...

{audience_info}
【评审意见和讨论】
{all_reviews[:3000]}...

请生成综合评审报告，包含：
1. 共识总结（两个AI都认同的核心问题）
2. 争议点（两个AI有不同意见的地方）
3. 具体改进建议（每个建议包含：问题 + 改进方法 + 预期效果）
4. 修改后预期评分

要求：建议必须具体、可操作，避免泛泛而谈。"""

        return llm_client.chat(system_prompt, user_prompt, temperature=0.7, max_tokens=3000)


# 全局服务实例
_multi_agent_service = None


def get_multi_agent_service() -> MultiAgentReviewService:
    """获取双AI讨论评审服务实例（单例模式）"""
    global _multi_agent_service
    if _multi_agent_service is None:
        _multi_agent_service = MultiAgentReviewService()
    return _multi_agent_service
