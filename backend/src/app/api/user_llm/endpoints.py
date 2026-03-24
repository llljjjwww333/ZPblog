"""
用户自定义LLM配置API端点
"""
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.database import get_db
from app.model.user_llm_config import UserLLMConfig
from app.core.encryption import get_encryption
from app.api.recommendation.dependencies import get_current_user_required

logger = logging.getLogger(__name__)

router = APIRouter()


# ========== 请求/响应模型 ==========

class LLMConfigCreate(BaseModel):
    """创建LLM配置请求"""
    provider_id: str = Field(..., min_length=1, max_length=50, description="模型标识ID")
    name: str = Field(..., min_length=1, max_length=100, description="显示名称")
    description: Optional[str] = Field(None, max_length=255, description="模型描述")
    icon: str = Field("🤖", max_length=50, description="图标emoji")
    api_key: str = Field(..., min_length=1, max_length=500, description="API密钥")
    base_url: Optional[str] = Field(None, max_length=500, description="API基础URL")
    model_name: str = Field(..., min_length=1, max_length=100, description="模型名称")


class LLMConfigUpdate(BaseModel):
    """更新LLM配置请求"""
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=255)
    icon: Optional[str] = Field(None, max_length=50)
    api_key: Optional[str] = Field(None, max_length=500)
    base_url: Optional[str] = Field(None, max_length=500)
    model_name: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None


class LLMConfigResponse(BaseModel):
    """LLM配置响应"""
    id: int
    provider_id: str
    name: str
    description: Optional[str]
    icon: str
    base_url: Optional[str]
    model_name: str
    is_active: bool
    is_verified: bool
    usage_count: int
    last_used_at: Optional[str]
    created_at: Optional[str]


class LLMVerifyRequest(BaseModel):
    """验证模型请求"""
    api_key: str
    base_url: Optional[str] = None
    model_name: str


class LLMVerifyResponse(BaseModel):
    """验证模型响应"""
    success: bool
    message: str


# ========== API端点 ==========

@router.get("/user/llm-configs", response_model=List[LLMConfigResponse])
async def get_user_llm_configs(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_required)
):
    """
    获取当前用户的所有LLM配置
    """
    configs = db.query(UserLLMConfig).filter(
        UserLLMConfig.user_id == user_id
    ).order_by(UserLLMConfig.created_at.desc()).all()
    
    return [config.to_dict() for config in configs]


@router.post("/user/llm-configs", response_model=LLMConfigResponse)
async def create_llm_config(
    config: LLMConfigCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_required)
):
    """
    创建新的LLM配置
    
    - **provider_id**: 模型标识ID（只能是 gemini, gpt, claude）
    - **name**: 显示名称
    - **api_key**: API密钥（会被加密存储）
    - **base_url**: API基础URL（可选）
    - **model_name**: 模型名称（如 gemini-pro, gpt-4）
    """
    # 只允许三种模型类型
    ALLOWED_MODELS = {'gemini', 'gpt', 'claude'}
    
    if config.provider_id not in ALLOWED_MODELS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不支持的模型类型 '{config.provider_id}'。只允许: gemini, gpt, claude"
        )
    
    # 检查provider_id是否已存在
    existing = db.query(UserLLMConfig).filter(
        UserLLMConfig.user_id == user_id,
        UserLLMConfig.provider_id == config.provider_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"模型 '{config.provider_id}' 已存在，每个用户每种模型只能添加一个配置"
        )
    
    # 加密API密钥
    encryption = get_encryption()
    encrypted_key = encryption.encrypt(config.api_key)
    
    # 创建新配置
    new_config = UserLLMConfig(
        user_id=user_id,
        provider_id=config.provider_id,
        name=config.name,
        description=config.description,
        icon=config.icon,
        api_key=encrypted_key,
        base_url=config.base_url,
        model_name=config.model_name,
        is_active=True,
        is_verified=False  # 新配置默认未验证
    )
    
    db.add(new_config)
    db.commit()
    db.refresh(new_config)
    
    logger.info(f"用户 {user_id} 创建了新的LLM配置: {config.provider_id}")
    
    return new_config.to_dict()


@router.put("/user/llm-configs/{config_id}", response_model=LLMConfigResponse)
async def update_llm_config(
    config_id: int,
    config_update: LLMConfigUpdate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_required)
):
    """
    更新LLM配置
    """
    config = db.query(UserLLMConfig).filter(
        UserLLMConfig.id == config_id,
        UserLLMConfig.user_id == user_id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="配置不存在"
        )
    
    # 更新字段
    update_data = config_update.dict(exclude_unset=True)
    
    # 如果更新API密钥，需要重新加密
    if "api_key" in update_data and update_data["api_key"]:
        encryption = get_encryption()
        update_data["api_key"] = encryption.encrypt(update_data["api_key"])
        # 更新API密钥后重置验证状态
        update_data["is_verified"] = False
    
    for field, value in update_data.items():
        setattr(config, field, value)
    
    db.commit()
    db.refresh(config)
    
    logger.info(f"用户 {user_id} 更新了LLM配置: {config_id}")
    
    return config.to_dict()


@router.delete("/user/llm-configs/{config_id}")
async def delete_llm_config(
    config_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_required)
):
    """
    删除LLM配置
    """
    config = db.query(UserLLMConfig).filter(
        UserLLMConfig.id == config_id,
        UserLLMConfig.user_id == user_id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="配置不存在"
        )
    
    db.delete(config)
    db.commit()
    
    logger.info(f"用户 {user_id} 删除了LLM配置: {config_id}")
    
    return {"success": True, "message": "配置已删除"}


@router.post("/user/llm-configs/verify", response_model=LLMVerifyResponse)
async def verify_llm_config(
    verify_data: LLMVerifyRequest
):
    """
    验证LLM配置是否可用
    
    尝试调用模型API验证配置是否正确
    """
    try:
        import openai
        import httpx
        
        # 创建临时客户端验证
        timeout = httpx.Timeout(10.0, connect=5.0)
        http_client = httpx.Client(timeout=timeout)
        
        client = openai.OpenAI(
            api_key=verify_data.api_key,
            base_url=verify_data.base_url or None,
            http_client=http_client
        )
        
        # 尝试简单的API调用验证
        response = client.chat.completions.create(
            model=verify_data.model_name,
            messages=[{"role": "user", "content": "Hello"}],
            max_tokens=5,
            timeout=10
        )
        
        http_client.close()
        
        return LLMVerifyResponse(
            success=True,
            message=f"验证成功！模型返回: {response.choices[0].message.content[:20]}..."
        )
        
    except Exception as e:
        logger.error(f"模型验证失败: {e}")
        return LLMVerifyResponse(
            success=False,
            message=f"验证失败: {str(e)}"
        )


@router.get("/user/llm-configs/{config_id}/api-key")
async def get_llm_config_api_key(
    config_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_required)
):
    """
    获取LLM配置的API密钥（解密后）
    
    **注意**: 此端点仅用于编辑时显示，请谨慎使用
    """
    config = db.query(UserLLMConfig).filter(
        UserLLMConfig.id == config_id,
        UserLLMConfig.user_id == user_id
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="配置不存在"
        )
    
    # 解密API密钥
    encryption = get_encryption()
    try:
        decrypted_key = encryption.decrypt(config.api_key)
        # 只返回前10位和后4位，中间用***代替
        masked_key = decrypted_key[:10] + "***" + decrypted_key[-4:] if len(decrypted_key) > 14 else "***"
        return {
            "api_key": decrypted_key,  # 返回完整密钥用于编辑
            "masked_key": masked_key,
            "provider_id": config.provider_id
        }
    except Exception as e:
        logger.error(f"解密API密钥失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="无法解密API密钥"
        )
