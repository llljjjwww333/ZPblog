"""
认证相关的API端点
"""
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Form
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import json
from app.database import get_db
from app.model.user import User
from typing import Union
from app.core.security import (
    verify_password, get_password_hash, create_access_token,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from app.schemas.user import (
    UserCreate, UserResponse, TokenResponse, UserLogin, UserUpdate, UserSimple
)
from app.api.auth.dependencies import (
    get_current_user, get_current_active_user, get_current_admin_user
)

router = APIRouter(tags=["auth"])

@router.post("/auth/register", 
             response_model=UserResponse, 
             status_code=status.HTTP_201_CREATED,
             summary="用户注册",
             description="注册新用户账户")
async def register(
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    """
    用户注册
    
    - **username**: 用户名（唯一）
    - **email**: 邮箱（唯一）
    - **password**: 密码（至少6位）
    - **full_name**: 全名（可选）
    """
    
    # 检查用户名是否已存在
    existing_user = db.query(User).filter(User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已存在"
        )
    
    # 检查邮箱是否已存在
    existing_email = db.query(User).filter(User.email == user_data.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="邮箱已存在"
        )
    
    # 创建用户对象
    hashed_password = get_password_hash(user_data.password)
    db_user = User(
        username=user_data.username,
        email=user_data.email,
        nickname=user_data.nickname,
        hashed_password=hashed_password,
        role="author"  # 默认角色为作者
    )
    
    # 保存到数据库
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user

@router.post("/login", 
             response_model=TokenResponse,
             summary="用户登录",
             description="使用用户名/邮箱和密码登录，获取JWT令牌")
async def login(
    login_data: UserLogin,
    db: Session = Depends(get_db)
):
    """
    用户登录

    - **username**: 用户名或邮箱
    - **password**: 密码
    """
     # 查找用户（支持用户名或邮箱登录）
    user = db.query(User).filter(
        (User.username == login_data.username) |
        (User.email == login_data.username)
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 🔴 关键修复：正确验证密码

    if not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户已被禁用"
        )
    
    # 更新最后登录时间
    from datetime import datetime
    user.last_login = datetime.now()
    db.commit()
    
    # 创建访问令牌
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "user_id": user.id},
        expires_delta=access_token_expires
    )
    
    return TokenResponse(
        access_token=access_token,
        user=user
    )

@router.post("/login/form", 
             response_model=TokenResponse,
             include_in_schema=True)  # 不在docs中显示，用于表单登录
async def login_for_access_token(
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    """兼容OAuth2标准表单登录"""
    user = db.query(User).filter(
        (User.username == username) | 
        (User.email == username)
    ).first()
    
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "user_id": user.id},
        expires_delta=access_token_expires
    )
    
    return TokenResponse(
        access_token=access_token,
        user=user
    )

@router.get("/me", 
            response_model=UserResponse,
            summary="获取当前用户",
            description="获取当前登录用户的信息")
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user)
):
    """
    获取当前登录用户信息
    """
    return current_user

from app.model.post import Post
from app.model.comment import Comment
from sqlalchemy import func

@router.get("/me/stats",
            summary="获取用户统计数据",
            description="获取当前用户的文章数、评论数和获赞数")
async def get_user_stats(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    获取用户统计数据
    """
    # 统计文章数
    post_count = db.query(Post).filter(Post.author_id == current_user.id).count()
    
    # 统计评论数
    comment_count = db.query(Comment).filter(Comment.author_id == current_user.id).count()
    
    # 统计获赞数 (目前只统计评论获赞)
    # 注意：如果 comment.likes 为 null，sum 会返回 None，需要处理
    like_count_result = db.query(func.sum(Comment.likes)).filter(Comment.author_id == current_user.id).scalar()
    like_count = like_count_result if like_count_result else 0
    
    return {
        "article_count": post_count,
        "comment_count": comment_count,
        "like_count": like_count
    }

@router.put("/me", 
            response_model=UserResponse,
            summary="更新当前用户",
            description="更新当前登录用户的信息")
async def update_current_user(
    user_data: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    更新当前用户信息
    
    - **email**: 新邮箱（可选）
    - **nickname**: 新昵称（可选）
    - **password**: 新密码（可选）
    - **avatar**: 新头像URL（可选）
    - **bio**: 个人简介（可选）
    - **background_image**: 个人背景图URL（可选）
    """
    
    update_data = user_data.model_dump(exclude_unset=True)
    
    # 如果更新了密码，需要哈希处理
    if "password" in update_data:
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
    
    # 如果更新了邮箱，检查是否重复
    if "email" in update_data and update_data["email"] != current_user.email:
        existing_email = db.query(User).filter(
            User.email == update_data["email"],
            User.id != current_user.id
        ).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="邮箱已存在"
            )
    
    # 更新字段
    for field, value in update_data.items():
        setattr(current_user, field, value)
    
    db.commit()
    db.refresh(current_user)
    
    return current_user

@router.get("/admin/test",
            summary="管理员测试",
            description="测试管理员权限端点")
async def admin_test(
    current_user: User = Depends(get_current_admin_user)
):
    """
    管理员测试端点
    只有管理员可以访问
    """
    return {
        "message": f"欢迎管理员 {current_user.username}",
        "user": current_user.username,
        "role": current_user.role
    }

@router.get("/users/{user_id}", 
            response_model=UserSimple,
            summary="获取指定用户信息",
            description="获取指定ID用户的公开信息")
async def get_user_info(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    获取指定用户信息（公开信息）
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    return user
