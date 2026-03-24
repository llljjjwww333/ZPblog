"""
AI 写作辅助服务 - 提供文章润色、续写、标题生成等功能
"""
import os
import requests
from typing import Optional, Dict, Any
from app.config import settings


class AIWritingService:
    """AI 写作辅助服务"""
    
    def __init__(self):
        self.ai_provider = settings.AI_PROVIDER  # openai / azure / local
        self.api_key = settings.AI_API_KEY
        self.api_base = settings.AI_API_BASE
        self.model = settings.AI_MODEL
    
    def polish_text(self, text: str, style: str = "professional") -> Dict[str, Any]:
        """
        润色文章文本
        
        Args:
            text: 需要润色的文本
            style: 润色风格 (professional/fluent/concise/creative)
        
        Returns:
            包含润色后文本和修改说明的字典
        """
        style_prompts = {
            "professional": "使用专业、正式的语言风格",
            "fluent": "让文章更流畅、易读",
            "concise": "精简内容，去除冗余",
            "creative": "增加创意和文学性"
        }
        
        style_desc = style_prompts.get(style, style_prompts["professional"])
        
        prompt = f"""请对以下文章进行润色。{style_desc}。

要求：
1. 保持原文的核心意思和结构
2. 修正语法错误和不通顺的表达
3. 提升语言的准确性和表现力
4. 返回润色后的完整文本

原文：
{text}

请直接返回润色后的文本，不需要解释修改原因。"""

        try:
            polished_text = self._call_ai_model(prompt)
            return {
                "success": True,
                "original": text,
                "polished": polished_text.strip(),
                "style": style
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "original": text,
                "style": style
            }
    
    def continue_writing(self, text: str, context: str = "") -> Dict[str, Any]:
        """
        根据上下文续写文章
        
        Args:
            text: 已有文本
            context: 续写要求或提示
        
        Returns:
            包含续写内容的字典
        """
        prompt = f"""请根据以下文章内容进行续写。

已有内容：
{text}

续写要求：{context or "根据上文自然延续，保持文章风格和主题一致"}

要求：
1. 与上文衔接自然
2. 保持文章风格和主题一致
3. 续写内容约200-500字
4. 直接返回续写的内容，不需要重复上文

请开始续写："""

        try:
            continuation = self._call_ai_model(prompt)
            return {
                "success": True,
                "continuation": continuation.strip(),
                "context": context
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def generate_title(self, content: str, count: int = 5) -> Dict[str, Any]:
        """
        根据文章内容生成标题建议
        
        Args:
            content: 文章内容
            count: 生成标题数量
        
        Returns:
            包含标题建议列表的字典
        """
        prompt = f"""请为以下文章生成{count}个标题建议。

文章内容：
{content[:2000]}  # 限制长度避免超出token限制

要求：
1. 标题要吸引人且准确反映文章主题
2. 包含不同风格的标题（如疑问式、陈述式、数字式等）
3. 每个标题一行
4. 只返回标题列表，不需要编号或其他说明

请生成标题："""

        try:
            titles_text = self._call_ai_model(prompt)
            titles = [t.strip() for t in titles_text.strip().split('\n') if t.strip()]
            return {
                "success": True,
                "titles": titles[:count],
                "count": len(titles[:count])
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def generate_summary(self, content: str, max_length: int = 200) -> Dict[str, Any]:
        """
        生成文章摘要
        
        Args:
            content: 文章内容
            max_length: 摘要最大长度
        
        Returns:
            包含摘要的字典
        """
        prompt = f"""请为以下文章生成摘要，限制在{max_length}字以内。

文章内容：
{content}

要求：
1. 概括文章的核心观点和主要内容
2. 语言简洁明了
3. 吸引读者阅读全文
4. 直接返回摘要内容

摘要："""

        try:
            summary = self._call_ai_model(prompt)
            return {
                "success": True,
                "summary": summary.strip()[:max_length],
                "max_length": max_length
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def improve_writing(self, text: str, improvement_type: str = "grammar") -> Dict[str, Any]:
        """
        针对性改进文章
        
        Args:
            text: 需要改进的文本
            improvement_type: 改进类型 (grammar/structure/vocabulary/readability)
        
        Returns:
            包含改进后文本的字典
        """
        improvement_prompts = {
            "grammar": "修正语法错误和标点符号使用",
            "structure": "优化段落结构和逻辑顺序",
            "vocabulary": "提升词汇的准确性和多样性",
            "readability": "提高文章的可读性和易懂性"
        }
        
        improvement_desc = improvement_prompts.get(improvement_type, improvement_prompts["grammar"])
        
        prompt = f"""请对以下文章进行改进。重点：{improvement_desc}。

原文：
{text}

要求：
1. 保持原文的核心意思
2. 只针对指定的方面进行改进
3. 返回改进后的完整文本
4. 直接返回文本，不需要解释

改进后的文章："""

        try:
            improved_text = self._call_ai_model(prompt)
            return {
                "success": True,
                "original": text,
                "improved": improved_text.strip(),
                "improvement_type": improvement_type
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "original": text
            }
    
    def _call_ai_model(self, prompt: str) -> str:
        """调用 AI 模型"""
        if self.ai_provider == "openai":
            return self._call_openai(prompt)
        elif self.ai_provider == "azure":
            return self._call_azure_openai(prompt)
        elif self.ai_provider == "local":
            return self._call_local_model(prompt)
        else:
            raise ValueError(f"不支持的 AI 提供商: {self.ai_provider}")
    
    def _call_openai(self, prompt: str) -> str:
        """调用 OpenAI API"""
        import openai
        
        client = openai.OpenAI(
            api_key=self.api_key,
            base_url=self.api_base if self.api_base else None
        )
        
        response = client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "你是一个专业的写作助手，擅长文章润色、续写和优化。"},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=2000
        )
        
        return response.choices[0].message.content
    
    def _call_azure_openai(self, prompt: str) -> str:
        """调用 Azure OpenAI API"""
        import openai
        
        client = openai.AzureOpenAI(
            api_key=self.api_key,
            api_version="2024-02-01",
            azure_endpoint=self.api_base
        )
        
        response = client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "你是一个专业的写作助手，擅长文章润色、续写和优化。"},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=2000
        )
        
        return response.choices[0].message.content
    
    def _call_local_model(self, prompt: str) -> str:
        """调用本地模型（Ollama）"""
        response = requests.post(
            f"{self.api_base}/api/generate",
            json={
                "model": self.model,
                "prompt": f"你是一个专业的写作助手，擅长文章润色、续写和优化。\n\n{prompt}",
                "stream": False
            },
            timeout=120
        )
        
        if response.status_code == 200:
            return response.json().get("response", "")
        else:
            raise Exception(f"本地模型调用失败: {response.status_code}")
