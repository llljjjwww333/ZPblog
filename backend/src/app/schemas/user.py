"""
用户相关的数据验证Schema
"""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import datetime
from enum import Enum

class UserRole(str, Enum):
    """用户角色枚举"""
    ADMIN = "admin"
    AUTHOR = "author"
    GUEST = "guest"

# 用户注册Schema
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, description="用户名")
    email: EmailStr = Field(..., description="邮箱")
    password: str = Field(..., min_length=6, description="密码")
    nickname: Optional[str] = Field(None, max_length=100, description="昵称")

# 用户登录Schema
class UserLogin(BaseModel):
    username: str = Field(..., description="用户名或邮箱")
    password: str = Field(..., description="密码")

# 用户更新Schema
class UserUpdate(BaseModel):
    email: Optional[EmailStr] = Field(None, description="邮箱")
    nickname: Optional[str] = Field(None, max_length=100, description="昵称")
    password: Optional[str] = Field(None, min_length=6, description="新密码")
    avatar: Optional[str] = Field(None, description="头像URL")
    bio: Optional[str] = Field(None, max_length=500, description="个人简介")
    background_image: Optional[str] = Field(None, description="个人背景图URL")
    github_url: Optional[str] = Field(None, max_length=255, description="GitHub主页链接")
    gitee_url: Optional[str] = Field(None, max_length=255, description="Gitee主页链接")

# 用户响应Schema（返回给客户端）
class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    nickname: Optional[str]
    avatar: Optional[str] = None
    bio: Optional[str] = None
    background_image: Optional[str] = None
    github_url: Optional[str] = None
    gitee_url: Optional[str] = None
    role: str
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# 用户简要信息（用于文章等关联）
class UserSimple(BaseModel):
    id: int
    username: str
    nickname: Optional[str]
    avatar: Optional[str] = None
    
    class Config:
        from_attributes = True

# 令牌响应Schema
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# 令牌数据Schema
class TokenData(BaseModel):
    username: Optional[str] = None
    user_id: Optional[int] = None