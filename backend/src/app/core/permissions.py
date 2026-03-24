"""
权限和数据隔离工具
"""
from typing import Optional, Any, List
from sqlalchemy.orm import Query
from sqlalchemy import and_
from fastapi import HTTPException, status

from app.model.user import User
from app.model.post import Post
from app.model.category import Category

class DataScope:
    
    @staticmethod
    def filter_posts_by_user(query: Query, user: User, allow_admin: bool = True) -> Query:
        """
        根据用户过滤文章查询
        
        Args:
            query: SQLAlchemy查询对象
            user: 当前用户
            allow_admin: 是否允许管理员查看所有文章
        
        Returns:
            过滤后的查询
        """
        # 管理员可以查看所有文章（如果允许）
        if allow_admin and user.role == "admin":
            return query
        
        # 普通用户只能查看自己的文章
        return query.filter(Post.author_id == user.id)
    
    @staticmethod
    def filter_categories_by_user(query: Query, user: User) -> Query:
        """
        根据用户过滤分类查询（如果需要的话）
        通常分类是共享的，但可以按需定制
        """
        # 分类通常是共享的，但你可以根据业务需求调整
        if user.role == "admin":
            return query
        # 普通用户只能看到已启用的分类
        return query.filter(Category.is_active == True)
    
    @staticmethod
    def check_post_ownership(post_id: int, user: User, db) -> Post:
        
        post = db.query(Post).filter(Post.id == post_id).first()
        
        if not post:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"文章 ID {post_id} 不存在"
            )
        
        # 管理员可以访问所有文章
        if user.role == "admin":
            return post
        
        # 作者只能访问自己的文章
        if post.author_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权访问该文章"
            )
        
        return post
    
    @staticmethod
    def check_resource_ownership(resource, user: User, resource_type: str = "文章"):
        """
        检查资源所有权（通用方法）
        """
        if user.role == "admin":
            return
        
        # 检查资源是否有 author_id 字段
        if hasattr(resource, 'author_id'):
            if resource.author_id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"无权访问该{resource_type}"
                )
        else:
            raise ValueError(f"资源类型 {resource_type} 不支持所有权检查")