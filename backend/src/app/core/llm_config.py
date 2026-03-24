"""
LLM API 统一配置文件
支持 DeepSeek、Qwen(千问) 等多个大模型提供商
"""
import os
from typing import Dict, Optional, List
from dataclasses import dataclass
from app.config import settings


@dataclass
class LLMProviderConfig:
    """LLM 提供商配置"""
    name: str  # 提供商名称
    api_key: str  # API 密钥
    base_url: str  # API 基础地址
    model: str  # 模型名称
    icon: str  # 显示图标
    description: str  # 描述
    enabled: bool = True  # 是否启用


class LLMConfig:
    """
    LLM 统一配置管理器
    
    配置优先级：
    1. 环境变量（LLM_{PROVIDER}_API_KEY）
    2. settings 配置（.env 文件）
    3. 默认值
    """
    
    # 默认配置
    DEFAULT_CONFIGS = {
        'deepseek': {
            'name': 'DeepSeek',
            'base_url': 'https://api.deepseek.com',
            'model': 'deepseek-chat',
            'icon': '🔍',
            'description': '深度求索大模型',
        },
        'qwen': {
            'name': '千问 (Qwen)',
            'base_url': 'https://dashscope.aliyuncs.com/compatible-mode/v1',
            'model': 'qwen-turbo',
            'icon': '🇨🇳',
            'description': '阿里云大模型',
        },
        'openai': {
            'name': 'OpenAI',
            'base_url': 'https://api.openai.com/v1',
            'model': 'gpt-3.5-turbo',
            'icon': '🤖',
            'description': 'OpenAI GPT 模型',
        }
    }
    
    def __init__(self):
        self.providers: Dict[str, LLMProviderConfig] = {}
        self._load_configs()
    
    def _load_configs(self):
        """加载所有 LLM 配置"""
        # 加载 DeepSeek 配置
        self._load_provider('deepseek', [
            os.getenv('DEEPSEEK_API_KEY'),
            os.getenv('AI_API_KEY'),
            settings.AI_API_KEY if hasattr(settings, 'AI_API_KEY') else None
        ])
        
        # 加载 Qwen 配置
        self._load_provider('qwen', [
            os.getenv('QWEN_API_KEY'),
            os.getenv('DASHSCOPE_API_KEY'),
        ])
        
        # 加载 OpenAI 配置
        self._load_provider('openai', [
            os.getenv('OPENAI_API_KEY'),
        ])
        
        # 打印最终加载结果
        enabled = self.get_provider_ids()
        print(f"[LLM配置] 已启用的提供商: {', '.join(enabled) if enabled else '无'}")
    
    def _load_provider(self, provider_id: str, api_key_sources: List[Optional[str]]):
        """
        加载单个提供商配置
        
        Args:
            provider_id: 提供商ID (deepseek/qwen/openai)
            api_key_sources: API密钥来源列表（按优先级排序）
        """
        default_config = self.DEFAULT_CONFIGS.get(provider_id)
        if not default_config:
            return
        
        # 获取第一个非空的 API 密钥
        api_key = None
        for key in api_key_sources:
            if key and key.strip():
                api_key = key.strip()
                break
        
        # DeepSeek 特殊处理：如果配置了 AI_API_KEY 且 provider 是 deepseek
        if provider_id == 'deepseek' and not api_key:
            # 检查是否是 DeepSeek 的 API Key（以 sk- 开头）
            ai_key = os.getenv('AI_API_KEY') or settings.AI_API_KEY
            if ai_key and ai_key.startswith('sk-') and len(ai_key) > 20:
                api_key = ai_key
        
        # Qwen 配置：必须从环境变量读取API密钥
        # 出于安全考虑，不再支持硬编码密钥
        
        if api_key:
            self.providers[provider_id] = LLMProviderConfig(
                name=default_config['name'],
                api_key=api_key,
                base_url=default_config['base_url'],
                model=default_config['model'],
                icon=default_config['icon'],
                description=default_config['description'],
                enabled=True
            )
            print(f"[LLM配置] {default_config['name']} 已启用")
        else:
            print(f"[LLM配置] {default_config['name']} 未配置 API 密钥，已跳过")
    
    def get_provider(self, provider_id: str) -> Optional[LLMProviderConfig]:
        """获取指定提供商配置"""
        return self.providers.get(provider_id)
    
    def get_enabled_providers(self) -> Dict[str, LLMProviderConfig]:
        """获取所有已启用的提供商"""
        return {k: v for k, v in self.providers.items() if v.enabled}
    
    def get_provider_ids(self) -> List[str]:
        """获取所有已启用的提供商 ID 列表"""
        return list(self.get_enabled_providers().keys())
    
    def has_provider(self, provider_id: str) -> bool:
        """检查是否有指定提供商"""
        return provider_id in self.providers and self.providers[provider_id].enabled


# 全局配置实例
_llm_config = None


def get_llm_config() -> LLMConfig:
    """获取 LLM 配置实例（单例模式）"""
    global _llm_config
    if _llm_config is None:
        _llm_config = LLMConfig()
    return _llm_config


def reload_llm_config() -> LLMConfig:
    """重新加载 LLM 配置"""
    global _llm_config
    _llm_config = LLMConfig()
    return _llm_config
