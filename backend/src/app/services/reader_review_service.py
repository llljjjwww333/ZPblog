"""
AI 读者评审服务 - 多角色专家系统
提供逻辑检查、受众适配、SEO优化、风格指导、风险预警等功能
"""
import os
import asyncio
from typing import Dict, List, Optional, Any
from app.config import settings

# 全局 OpenAI 客户端缓存
_openai_client = None

def get_openai_client():
    """获取或创建 OpenAI 客户端（单例模式）"""
    global _openai_client
    if _openai_client is None:
        import openai
        _openai_client = openai.OpenAI(
            api_key=settings.AI_API_KEY,
            base_url=settings.AI_API_BASE if settings.AI_API_BASE else None,
            timeout=30.0  # 减少超时时间到30秒
        )
    return _openai_client


class ReaderRole:
    """读者角色定义"""
    
    FACT_CHECKER = "fact_checker"
    PERSONA_READER = "persona_reader"
    SEO_EXPERT = "seo_expert"
    STYLIST = "stylist"
    DEVIL_ADVOCATE = "devil_advocate"
    
    @classmethod
    def get_all_roles(cls) -> List[str]:
        return [
            cls.FACT_CHECKER,
            cls.PERSONA_READER,
            cls.SEO_EXPERT,
            cls.STYLIST,
            cls.DEVIL_ADVOCATE
        ]


class ReaderReviewService:
    """AI 读者评审服务"""
    
    # 角色配置
    ROLES_CONFIG = {
        ReaderRole.FACT_CHECKER: {
            "name": "逻辑与事实专家",
            "name_en": "Fact Checker",
            "icon": "🔍",
            "description": "检查逻辑漏洞、数据真实性、前后矛盾",
            "description_en": "Check logical flaws, data accuracy, and contradictions",
            "system_prompt": """你是一个专业的评审员。请在200字以内完成评审。

要求：
- 指出2-3个主要问题
- 可以简要分点说明
- 给出具体的改进建议
- 语言专业但有建设性"""
        },
        
        ReaderRole.PERSONA_READER: {
            "name": "目标读者画像",
            "name_en": "Persona Reader",
            "icon": "👤",
            "description": "自定义目标读者，从特定读者角度评估内容适配性",
            "description_en": "Define custom target readers to evaluate content suitability",
            "personas": {}  # 空字典，只支持自定义读者
        },
        
        ReaderRole.SEO_EXPERT: {
            "name": "SEO与传播专家",
            "name_en": "Growth Hacker",
            "icon": "📈",
            "description": "优化标题吸引力、关键词密度、排版易读性",
            "description_en": "Optimize title appeal, keyword density, and readability",
            "system_prompt": """你是一个专业的SEO评审员。请在200字以内完成评审。

要求：
- 指出2-3个SEO问题
- 可以简要分点说明
- 给出具体的优化建议
- 语言专业但有建设性"""
        },

        ReaderRole.STYLIST: {
            "name": "情感与风格教练",
            "name_en": "Stylist",
            "icon": "✨",
            "description": "优化语气风格，消除AI机味",
            "description_en": "Optimize tone and style, eliminate robotic feel",
            "system_prompt": """你是一个专业的风格评审员。请在200字以内完成评审。

要求：
- 指出2-3个风格问题
- 可以简要分点说明
- 给出具体的改进建议
- 语言专业但有建设性"""
        },

        ReaderRole.DEVIL_ADVOCATE: {
            "name": "负面挑刺员",
            "name_en": "Devil's Advocate",
            "icon": "😈",
            "description": "寻找争议点和被杠风险",
            "description_en": "Identify controversial points and risks",
            "system_prompt": """你是一个专业的风险评审员。请在200字以内完成评审。

要求：
- 指出2-3个潜在风险
- 可以简要分点说明
- 给出具体的规避建议
- 语言专业但有建设性"""
        }
    }
    
    def __init__(self):
        self.ai_provider = settings.AI_PROVIDER
        self.api_key = settings.AI_API_KEY
        self.api_base = settings.AI_API_BASE
        self.model = settings.AI_MODEL
    
    def get_roles_info(self, lang: str = 'zh') -> List[Dict[str, Any]]:
        """获取所有角色信息"""
        roles = []
        for role_id, config in self.ROLES_CONFIG.items():
            if role_id == ReaderRole.PERSONA_READER:
                # 读者画像有子角色
                personas = []
                for pid, pconfig in config["personas"].items():
                    personas.append({
                        "id": pid,
                        "name": pconfig["name"] if lang == 'zh' else pconfig["name_en"],
                        "description": pconfig["description"] if lang == 'zh' else pconfig.get("description_en", pconfig["description"])
                    })
                roles.append({
                    "id": role_id,
                    "name": config["name"] if lang == 'zh' else config["name_en"],
                    "icon": config["icon"],
                    "description": config["description"] if lang == 'zh' else config["description_en"],
                    "has_personas": True,
                    "personas": personas
                })
            else:
                roles.append({
                    "id": role_id,
                    "name": config["name"] if lang == 'zh' else config["name_en"],
                    "icon": config["icon"],
                    "description": config["description"] if lang == 'zh' else config["description_en"],
                    "has_personas": False
                })
        return roles
    
    def review_article(self, title: str, content: str, role: str, 
                      persona: Optional[str] = None,
                      custom_persona_name: Optional[str] = None,
                      custom_persona_desc: Optional[str] = None) -> Dict[str, Any]:
        """
        评审文章
        
        Args:
            title: 文章标题
            content: 文章内容
            role: 评审角色
            persona: 读者画像子角色（仅对 PERSONA_READER 有效）
            custom_persona_name: 自定义读者名称
            custom_persona_desc: 自定义读者描述
        
        Returns:
            评审结果
        """
        import time
        start_time = time.time()
        
        try:
            # 构建系统提示词
            system_prompt = self._build_system_prompt(role, persona, custom_persona_name, custom_persona_desc)
            
            # 限制内容长度，避免请求过大（最多1500字符，加快处理速度）
            max_content_length = 1500
            truncated_content = content[:max_content_length]
            if len(content) > max_content_length:
                truncated_content += "\n\n[内容已截断...]"
            
            # 构建用户提示词 - 根据是否是自定义读者来调整
            is_custom_persona = persona and persona.startswith('custom_')
            
            if is_custom_persona and custom_persona_name:
                # 对于自定义读者，把所有指令都放在 user prompt 中
                # 添加调试日志
                print(f"[DEBUG] 自定义读者评审: name={custom_persona_name}, desc={custom_persona_desc}")
                user_prompt = f"""【角色扮演 - 严格执行】

你现在不是AI，你是：{custom_persona_name}
你的状态：{custom_persona_desc}

【语言风格要求 - 根据你的身份决定】
- 如果你是专业人士（如教授、医生、工程师）：语言要严谨、专业、有理有据
- 如果你是普通大众（如上班族、学生、家长）：语言要自然、口语化、像日常聊天
- 如果你是轻松随意的人（如爱好者、玩家）：语言可以幽默、活泼、带表情
- 如果你是严肃认真的人（如学者、专家）：语言要正式、客观、有逻辑
- 如果你的认知水平受限（如儿童、老人、残障人士）：语言要简单、直接、表达真实困惑

【绝对禁止】
- 说"建议"、"应该"、"可以"、"改进"
- 分析文章结构
- 使用超出你身份的专业术语
- 评价写得好不好

【必须做到】
- 只用第一人称"我"
- 说"我"的真实感受和想法
- 符合你身份的语言风格
- 只写一段话，不要分段

【文章】
标题：{title}

{truncated_content}

【开始说话】
我看完这个后..."""
            else:
                user_prompt = f"""请评审以下文章：

标题：{title}

内容：
{truncated_content}

请根据你的角色定位，给出详细的评审意见。"""
            
            # 调用 AI 模型
            review_content = self._call_ai_model(system_prompt, user_prompt, is_custom_persona)
            
            # 解析评审结果
            parsed_review = self._parse_review(review_content)
            
            elapsed_time = time.time() - start_time
            print(f"[PERF] 评审完成: {role} - 耗时 {elapsed_time:.2f}秒")
            
            return {
                "success": True,
                "role": role,
                "persona": persona,
                "role_name": self._get_role_name(role, persona, custom_persona_name),
                "icon": self.ROLES_CONFIG.get(role, {}).get("icon", "📝"),
                "raw_review": review_content,
                "parsed_review": parsed_review
            }
            
        except Exception as e:
            elapsed_time = time.time() - start_time
            print(f"[PERF] 评审失败: {role} - 耗时 {elapsed_time:.2f}秒, 错误: {e}")
            return {
                "success": False,
                "error": str(e),
                "role": role,
                "persona": persona
            }
    
    def _build_system_prompt(self, role: str, persona: Optional[str] = None, 
                            custom_persona_name: Optional[str] = None,
                            custom_persona_desc: Optional[str] = None) -> str:
        """构建系统提示词"""
        config = self.ROLES_CONFIG.get(role, {})
        
        if role == ReaderRole.PERSONA_READER and persona:
            # 检查是否是自定义读者 (以 custom_ 开头)
            if persona.startswith('custom_') and custom_persona_name and custom_persona_desc:
                # 自定义读者的指令主要放在 user prompt 中，system prompt 简单提示
                return "你是一位正在阅读文章的普通人。请按照用户的要求回答。"
            
            personas = config.get("personas", {})
            persona_config = personas.get(persona, {})
            return persona_config.get("system_prompt", config.get("system_prompt", ""))
        
        return config.get("system_prompt", "你是一位专业的文章评审专家。")
    
    def _get_role_name(self, role: str, persona: Optional[str] = None,
                      custom_persona_name: Optional[str] = None) -> str:
        """获取角色名称"""
        config = self.ROLES_CONFIG.get(role, {})
        
        if role == ReaderRole.PERSONA_READER and persona:
            # 检查是否是自定义读者
            if persona.startswith('custom_') and custom_persona_name:
                return f"{config.get('name', '')} - {custom_persona_name}"
            
            personas = config.get("personas", {})
            persona_config = personas.get(persona, {})
            return f"{config.get('name', '')} - {persona_config.get('name', '')}"
        
        return config.get("name", "评审专家")
    
    def _call_ai_model(self, system_prompt: str, user_prompt: str, is_custom: bool = False) -> str:
        """调用 AI 模型"""
        try:
            # 检查是否配置了有效的 AI API
            if not self.api_key or self.api_key == "":
                print("[WARN] 未配置 AI API Key，使用模拟评审")
                return self._mock_review(system_prompt, user_prompt, is_custom)
            
            if self.ai_provider in ['openai', 'deepseek']:
                return self._call_openai(system_prompt, user_prompt, is_custom)
            else:
                # 默认使用 OpenAI 格式
                return self._call_openai(system_prompt, user_prompt, is_custom)
        except Exception as e:
            print(f"[ERROR] AI 调用失败: {e}，使用模拟评审")
            return self._mock_review(system_prompt, user_prompt, is_custom)
    
    def _call_openai(self, system_prompt: str, user_prompt: str, is_custom: bool = False) -> str:
        """调用 OpenAI API (支持 DeepSeek) - 使用缓存的客户端"""
        client = get_openai_client()
        
        # 减少 max_tokens 以加快响应速度
        max_tokens = 150 if is_custom else 200  # 强制生成短内容，100-150字
        
        response = client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.8 if is_custom else 0.6,  # 稍微降低温度，使输出更确定更快
            max_tokens=max_tokens,
            top_p=0.9 if is_custom else 1.0,
            stream=False  # 禁用流式输出，直接获取完整结果
        )
        
        content = response.choices[0].message.content
        # 如果内容过长，截断并添加提示
        max_length = 400  # 最大字符数，允许更详细的评审
        if len(content) > max_length:
            content = content[:max_length] + "..."
        return content
    
    def _mock_review(self, system_prompt: str, user_prompt: str, is_custom: bool = False) -> str:
        """模拟评审（当 AI API 不可用时使用）"""
        import random
        
        # 从 user_prompt 中提取标题
        title_match = __import__('re').search(r'标题[：:]\s*(.+?)(?:\n|$)', user_prompt)
        title = title_match.group(1).strip() if title_match else "这篇文章"
        
        if is_custom:
            # 自定义读者的模拟回复
            responses = [
                f"我看完《{title}》后，感觉内容挺有意思的，有些地方让我想起了自己的经历。不过有几个地方我看得不太明白，可能需要再解释一下。",
                f"读完《{title}》，我觉得作者写得挺用心的。但是作为一个普通读者，我希望能看到更多具体的例子，这样会更容易理解。",
                f"《{title}》这篇文章给我留下了不错的印象，观点挺新颖的。不过我有个小疑问，文中提到的一些说法是不是太绝对了？",
                f"看了《{title}》，整体感觉还行，但有些地方表达得不够清楚，我读了好几遍才大概明白是什么意思。",
                f"《{title}》的内容挺丰富的，但我个人觉得开头有点平淡，如果能更吸引人一些，我会更愿意读下去。"
            ]
            return random.choice(responses)
        else:
            # 专业评审的模拟回复 - 简短版本
            reviews = [
                f"《{title}》结构清晰。建议：1.过渡更自然 2.增加细节支撑 3.精简冗长句子。",
                f"《{title}》主题明确。改进：1.标题加悬念 2.开头用故事引入 3.补充数据案例。",
                f"《{title}》行文流畅。注意：1.段落衔接 2.论据充分性 3.增加小结段落。"
            ]
            return random.choice(reviews)
    
    def _parse_review(self, review_content: str) -> Dict[str, Any]:
        """解析评审内容，提取结构化信息"""
        import re
        
        parsed = {
            "summary": "",
            "issues": [],
            "suggestions": []
        }
        
        # 提取摘要（第一段或包含"总结"、"总体"的部分）
        lines = review_content.split('\n')
        if lines:
            parsed["summary"] = lines[0][:200] + "..." if len(lines[0]) > 200 else lines[0]
        
        # 提取问题列表（匹配 "-" 或数字开头的行）
        issue_pattern = r'(?:^|\n)[-\d\.\*]+\s*(.+?)(?=\n|$)'
        issues = re.findall(issue_pattern, review_content)
        parsed["issues"] = [issue.strip() for issue in issues[:5]]  # 最多5个问题
        
        # 提取建议（包含"建议"、"可以"、"应该"的句子）
        suggestion_keywords = ['建议', '可以', '应该', '推荐', '尝试']
        for line in lines:
            if any(keyword in line for keyword in suggestion_keywords) and len(line) > 10:
                parsed["suggestions"].append(line.strip())
        
        return parsed
    
    async def batch_review_async(self, title: str, content: str, roles: List[str]) -> List[Dict[str, Any]]:
        """
        异步批量评审文章 - 使用并发提高效率
        
        Args:
            title: 文章标题
            content: 文章内容
            roles: 评审角色列表
        
        Returns:
            各角色的评审结果
        """
        import asyncio
        
        tasks = []
        for role in roles:
            if role == ReaderRole.PERSONA_READER:
                # 读者画像需要评审所有子角色
                personas = self.ROLES_CONFIG[role].get("personas", {}).keys()
                for persona in personas:
                    # 创建异步任务
                    task = asyncio.create_task(
                        self._review_article_async(title, content, role, persona)
                    )
                    tasks.append(task)
            else:
                task = asyncio.create_task(
                    self._review_article_async(title, content, role)
                )
                tasks.append(task)
        
        # 并发执行所有任务
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 处理结果，过滤掉异常
        valid_results = []
        for result in results:
            if isinstance(result, Exception):
                print(f"[ERROR] 评审任务失败: {result}")
                valid_results.append({
                    "success": False,
                    "error": str(result),
                    "role": "unknown"
                })
            else:
                valid_results.append(result)
        
        return valid_results
    
    async def _review_article_async(self, title: str, content: str, role: str, 
                                   persona: Optional[str] = None,
                                   custom_persona_name: Optional[str] = None,
                                   custom_persona_desc: Optional[str] = None) -> Dict[str, Any]:
        """异步评审文章（在线程池中执行）"""
        import asyncio
        loop = asyncio.get_event_loop()
        # 在线程池中执行同步的 review_article 方法
        return await loop.run_in_executor(
            None, 
            self.review_article, 
            title, content, role, persona, custom_persona_name, custom_persona_desc
        )
    
    def batch_review(self, title: str, content: str, roles: List[str]) -> List[Dict[str, Any]]:
        """
        批量评审文章（同步接口，内部使用异步）
        
        Args:
            title: 文章标题
            content: 文章内容
            roles: 评审角色列表
        
        Returns:
            各角色的评审结果
        """
        import asyncio
        # 运行异步批量评审
        return asyncio.run(self.batch_review_async(title, content, roles))
