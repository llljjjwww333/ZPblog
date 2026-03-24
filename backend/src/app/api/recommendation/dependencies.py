"""
推荐系统API依赖函数
"""
import logging
from typing import Optional
from fastapi import Request, HTTPException, status
from app.core.security import verify_token

# 配置logger
logger = logging.getLogger(__name__)


async def get_current_user_optional(request: Request) -> Optional[int]:
    """
    获取当前用户ID（可选）
    
    从请求头中解析JWT token，获取用户ID
    如果token无效或不存在，返回None（游客模式）
    
    Args:
        request: FastAPI请求对象
        
    Returns:
        用户ID或None
    """
    auth_header = request.headers.get('authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    
    try:
        token = auth_header.split(' ')[1]
        payload = verify_token(token)
        user_id = payload.get('user_id')
        logger.debug(f"Token验证成功，用户ID: {user_id}")
        return user_id
    except Exception as e:
        logger.debug(f"Token验证失败: {e}")
        return None


async def get_current_user_required(request: Request) -> int:
    """
    获取当前用户ID（必需）
    
    从请求头中解析JWT token，获取用户ID
    如果token无效或不存在，抛出401异常
    
    Args:
        request: FastAPI请求对象
        
    Returns:
        用户ID
        
    Raises:
        HTTPException: 401未授权
    """
    user_id = await get_current_user_optional(request)
    if user_id is None:
        logger.warning("未授权访问，缺少有效token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="请先登录"
        )
    return user_id
