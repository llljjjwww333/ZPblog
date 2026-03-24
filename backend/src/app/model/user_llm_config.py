"""
用户自定义LLM配置模型
支持用户添加自己的API密钥和模型配置
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from sqlalchemy.sql import func
from app.database import Base


class UserLLMConfig(Base):
    """用户自定义LLM配置表"""
    __tablename__ = "user_llm_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False, comment="用户ID")
    
    # 模型基本信息
    provider_id = Column(String(50), nullable=False, comment="模型标识ID，如gemini-pro, gpt-4等")
    name = Column(String(100), nullable=False, comment="显示名称")
    description = Column(String(255), nullable=True, comment="模型描述")
    icon = Column(String(50), default="🤖", comment="图标emoji")
    
    # API配置（加密存储）
    api_key = Column(String(500), nullable=False, comment="API密钥（加密存储）")
    base_url = Column(String(500), nullable=True, comment="API基础URL")
    model_name = Column(String(100), nullable=False, comment="模型名称，如gpt-4, gemini-pro等")
    
    # 状态
    is_active = Column(Boolean, default=True, comment="是否启用")
    is_verified = Column(Boolean, default=False, comment="是否验证通过")
    
    # 使用统计
    usage_count = Column(Integer, default=0, comment="使用次数")
    last_used_at = Column(DateTime, nullable=True, comment="最后使用时间")
    
    # 时间戳
    created_at = Column(DateTime, server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), comment="更新时间")
    
    def to_dict(self, include_api_key=False):
        """转换为字典"""
        data = {
            "id": self.id,
            "user_id": self.user_id,
            "provider_id": self.provider_id,
            "name": self.name,
            "description": self.description,
            "icon": self.icon,
            "base_url": self.base_url,
            "model_name": self.model_name,
            "is_active": self.is_active,
            "is_verified": self.is_verified,
            "usage_count": self.usage_count,
            "last_used_at": self.last_used_at.isoformat() if self.last_used_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_api_key:
            data["api_key"] = self.api_key
        return data
