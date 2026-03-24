"""
分类相关的数据验证
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

#创建分类的schema
class CategoryCreate(BaseModel):
    name: str = Field(..., description="分类名称")
    description: Optional[str] = Field(None, description="分类描述")
    parent_id: Optional[int] = Field(None, description="父分类ID")
    image: Optional[str] = Field(None, description="分类封面图")

#更新分类的schema
class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, description="分类名称")
    description: Optional[str] = Field(None, description="分类描述")
    parent_id: Optional[int] = Field(None, description="父分类ID")
    image: Optional[str] = Field(None, description="分类封面图")

#分类详情响应的schema
class CategoryResponse(BaseModel):
    id: int = Field(..., description="分类ID")
    name: str = Field(..., description="分类名称")
    description: Optional[str] = Field(None, description="分类描述")
    parent_id: Optional[int] = Field(None, description="父分类ID")
    image: Optional[str] = Field(None, description="分类封面图")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: Optional[datetime] = Field(None, description="更新时间")

    class Config:
        from_attributes = True

#带子分类的树形结构的schema
class CategoryTree(CategoryResponse):
    children: List["CategoryTree"] = []

    class Config:
        from_attributes = True

#文章列表中的分类信息（简化版）
class CategorySimple(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True
