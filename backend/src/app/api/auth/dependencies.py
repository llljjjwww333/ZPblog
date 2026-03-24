"""
认证相关的依赖函数
"""
from typing import Optional
from fastapi import Depends, HTTPException, status, WebSocket, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError, jwt

from app.database import get_db, SessionLocal
from app.model.user import User
from app.core.security import verify_token, SECRET_KEY, ALGORITHM
from app.schemas.user import TokenData

# OAuth2密码Bearer流程
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login/form")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """获取当前登录用户"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无效的认证凭证",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # 验证令牌
        payload = verify_token(token)
        if payload is None:
            raise credentials_exception
        
        username: str = payload.get("sub")
        user_id: int = payload.get("user_id")
        
        if username is None or user_id is None:
            raise credentials_exception
        
        token_data = TokenData(username=username, user_id=user_id)
        
    except JWTError:
        raise credentials_exception
    
    # 从数据库获取用户
    user = db.query(User).filter(User.id == token_data.user_id).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=400, detail="用户已被禁用")
    
    return user

async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """获取当前活跃用户"""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="用户已被禁用")
    return current_user

async def get_current_admin_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """获取当前管理员用户"""
    if current_user.role not in ["admin", "superadmin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理员权限"
        )
    return current_user

async def get_current_author_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """获取当前作者用户"""
    if current_user.role not in ["admin", "author"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要作者或管理员权限"
        )
    return current_user

async def get_current_user_optional(
    request: Request,
    db: Session = Depends(get_db)
) -> Optional[User]:
    """获取当前登录用户（可选，未登录返回None）"""
    # 从请求头获取 token
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    
    token = auth_header.replace("Bearer ", "")
    if not token:
        return None
    
    try:
        # 验证令牌
        payload = verify_token(token)
        if payload is None:
            return None
        
        username: str = payload.get("sub")
        user_id: int = payload.get("user_id")
        
        if username is None or user_id is None:
            return None
        
        # 从数据库获取用户
        user = db.query(User).filter(User.id == user_id).first()
        if user is None or not user.is_active:
            return None
        
        return user
    except Exception:
        return None

async def get_current_active_user_ws(
    websocket: WebSocket
) -> User:
    """获取当前活跃用户（WebSocket版本）"""
    # 从查询参数获取token
    token = websocket.query_params.get("token")
    if not token:
        # 尝试从头部获取token
        token = websocket.headers.get("Authorization", "").replace("Bearer ", "")
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无效的认证凭证",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # 验证令牌
        payload = verify_token(token)
        if payload is None:
            raise credentials_exception
        
        username: str = payload.get("sub")
        user_id: int = payload.get("user_id")
        
        if username is None or user_id is None:
            raise credentials_exception
        
        token_data = TokenData(username=username, user_id=user_id)
        
    except JWTError:
        raise credentials_exception
    
    # 手动管理数据库会话
    db = SessionLocal()
    try:
        # 从数据库获取用户
        user = db.query(User).filter(User.id == token_data.user_id).first()
        if user is None:
            raise credentials_exception
        if not user.is_active:
            raise HTTPException(status_code=400, detail="用户已被禁用")
            
        return user
    finally:
        db.close()