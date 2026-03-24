"""
文章相关的数据验证Schema
定义请求和响应的数据结构
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum
from app.schemas.category import CategorySimple

class PostStatus(str, Enum):
    """文章状态枚举"""
    DRAFT = "draft"      # 草稿
    PUBLISHED = "published"  # 已发布
    PRIVATE = "private"  # 私密

# 创建文章时的Schema（用户提交的数据）从前端来的
class PostCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200, description="文章标题")
    content_markdown: str = Field(..., min_length=1, description="Markdown内容")
    excerpt: Optional[str] = Field(None, max_length=500, description="文章摘要")
    cover_image: Optional[str] = Field(None, description="封面图片URL")
    category_id: Optional[int] = Field(default=1, description="分类ID")
    status: PostStatus = Field(default=PostStatus.DRAFT, description="文章状态")

# 更新文章时的Schema（用户提交的数据）
class PostUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200, description="文章标题")
    content_markdown: Optional[str] = Field(None, min_length=1, description="Markdown内容")
    excerpt: Optional[str] = Field(None, max_length=500, description="文章摘要")
    cover_image: Optional[str] = Field(None, description="封面图片URL")
    category_id: Optional[int] = Field(None, description="分类ID")
    status: Optional[PostStatus] = Field(None, description="文章状态")

class UserSimple(BaseModel):
    id: int
    username: str
    nickname: Optional[str] = None
    avatar: Optional[str] = None
    
    class Config:
        from_attributes = True

# 文章详情响应的Schema（返回给用户的数据）
class PostResponse(BaseModel):
    id: int
    title: str
    content_markdown: str
    content_html: Optional[str]
    excerpt: Optional[str]
    cover_image: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: Optional[datetime]
    published_at: Optional[datetime]
    view_count: int
    author_id: int
    author: Optional[UserSimple] = None
    category_id: int
    category: Optional[CategorySimple] = None
    
    class Config:
        from_attributes = True  # 允许从ORM对象转换

# 文章列表响应的Schema（简化的文章信息）
class PostListItem(BaseModel):
    id: int
    title: str
    excerpt: Optional[str]
    cover_image: Optional[str] = None
    status: str
    created_at: datetime
    view_count: int
    author: Optional[UserSimple] = None
    category_id: Optional[int] = None
    
    class Config:
        from_attributes = True

# 极简文章信息（用于通知等关联）
class PostSimple(BaseModel):
    id: int
    title: str
    
    class Config:
        from_attributes = True

# 分页响应的Schema
class PostListResponse(BaseModel):
    total: int
    page: int
    size: int
    items: List[PostListItem]
