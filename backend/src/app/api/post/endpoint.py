from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.model.post import Post
from app.schemas.post import PostStatus, PostCreate, PostUpdate, PostListItem, PostListResponse, PostResponse
from app.api.auth.dependencies import (
    get_current_author_user, get_current_user
)
from app.model.user import User
from app.core.permissions import DataScope

from app.utils.markdown import markdown_to_html#markdown转换为html
from app.utils.image_generator import generate_cover_image


from enum import Enum

router = APIRouter(prefix="/posts")#创建路由

@router.post("/",
             response_model=PostResponse,# 文章详情响应的Schema
             status_code=status.HTTP_201_CREATED,
             summary="创建文章",#方便在Swagger UI中查看
             description="创建一篇新文章",)
async def create_post(
    post_data: PostCreate,
    current_user: User = Depends(get_current_author_user),#需要作者权限
    db: Session = Depends(get_db),#注入依赖
):
    # 检查用户是否被禁止发文
    # 如果 can_post 字段是 NULL，视为允许（兼容旧数据）
    if hasattr(current_user, 'can_post') and current_user.can_post is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="您已被禁止发布文章，请联系管理员"
        )

    # 准备文章数据
    post_dict = post_data.model_dump()
    
    # 处理枚举类型
    if isinstance(post_dict.get('status'), Enum):
        post_dict['status'] = post_dict['status'].value

    # 创建文章对象
    db_post = Post(**post_dict)
    db_post.author_id = current_user.id#设置作者ID

    if post_data.content_markdown:
        db_post.content_html = markdown_to_html(post_data.content_markdown)

    # 如果没有提供封面图片，自动生成
    if not post_data.cover_image:
        cover_image_path = generate_cover_image(
            title=post_data.title,
            content=post_data.content_markdown
        )
        if cover_image_path:
            db_post.cover_image = cover_image_path

    # 数据库入库三步曲
    db.add(db_post)#添加到数据库
    db.commit()#提交
    db.refresh(db_post)  # 刷新以获取数据库生成的ID等字段
    
    return db_post





@router.get("/public/",
            response_model=PostListResponse,
            status_code=status.HTTP_200_OK,
            summary="获取公开文章列表",
            description="获取所有公开发布的文章列表")
async def get_public_post_list(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(10, ge=1, le=100, description="每页数量"),
    category_id: Optional[int] = Query(None, description="分类ID"),
    search: Optional[str] = Query(None, description="搜索关键词，按文章标题搜索"),
    db: Session = Depends(get_db),
):
    """
    获取公开文章列表（无需登录）
    """
    from datetime import datetime, timedelta
    
    # 构建查询
    query = db.query(Post).filter(Post.status == PostStatus.PUBLISHED.value)
    
    # 搜索过滤
    if search:
        query = query.filter(Post.title.ilike(f"%{search}%"))
    else:
        # 仅在未搜索时限制最近60天
        # 只显示近60天发布的文章
        sixty_days_ago = datetime.now() - timedelta(days=60)
        query = query.filter(Post.created_at >= sixty_days_ago)
    
    # 文章分类过滤
    if category_id:
        query = query.filter(Post.category_id == category_id)

    # 计算总数
    total = query.count()
    
    # 应用分页
    offset = (page - 1) * size
    posts = query.order_by(Post.created_at.desc()).offset(offset).limit(size).all()
    
    # 转换为列表项
    items = [PostListItem.model_validate(post) for post in posts]
    
    return PostListResponse(
        total=total,
        page=page,
        size=size,
        items=items
    )

#获取文章列表
@router.get("/",
            response_model=PostListResponse,# 文章列表响应的Schema
            status_code=status.HTTP_200_OK,
            summary="获取文章列表",#方便在Swagger UI中查看
            description="获取文章列表",#方便在Swagger UI中查看
            )
async def get_post_list(
    page: int = Query(1, ge=1, description="页码"),#page默认为1，ge大于等于
    db: Session = Depends(get_db),#注入依赖
    size: int = Query(10, ge=1, le=100, description="每页数量"),#size默认为10，ge大于等于，le小于等于，最大值为100
    status: Optional[PostStatus] = Query(None, description="文章状态"),#按状态筛选
    category_id: Optional[int] = Query(None, description="分类ID"),#按分类筛选
    search: Optional[str] = Query(None, description="搜索关键词，按文章标题搜索"),#添加搜索参数
    current_user: User = Depends(get_current_user),#添加当前用户依赖
    show_all: bool = Query(False, description="是否显示所有文章，仅管理员可用"),#添加显示所有文章的参数
):
    # 构建查询
    query = db.query(Post)
    
    # 数据隔离：使用DataScope过滤文章
    if not show_all:
        query = DataScope.filter_posts_by_user(query, current_user, allow_admin=False)
    else:
        query = DataScope.filter_posts_by_user(query, current_user)
    
    # 文章状态过滤
    if status:
        query = query.filter(Post.status == status.value)#post表中的status字段等于status.value（enum实例）
    # 文章分类过滤
    if category_id:
        query = query.filter(Post.category_id == category_id)
    # 搜索过滤
    if search:
        query = query.filter(Post.title.ilike(f"%{search}%"))#模糊搜索标题

    # 计算总数
    total = query.count()
    
    # 应用分页
    offset = (page - 1) * size
    posts = query.order_by(Post.created_at.desc()).offset(offset).limit(size).all()
    
    # 转换为列表项
    items = [PostListItem.model_validate(post) for post in posts]
    
    return PostListResponse(
        total=total,
        page=page,
        size=size,
        items=items
    )




@router.get("/public/{post_id}/", 
            response_model=PostResponse,
            summary="获取公开单篇文章",
            description="根据ID获取单篇文章的详细信息（无需登录）")
async def get_public_post(
    post_id: int,
    increment_view: bool = Query(True, description="是否增加阅读量"),
    db: Session = Depends(get_db),
):
    """
    获取公开单篇文章（无需登录）
    """
    post = db.query(Post).filter(Post.id == post_id).first()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"文章 ID {post_id} 不存在"
        )
        
    # 检查文章状态是否为已发布
    if post.status != PostStatus.PUBLISHED.value:
         raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, # 为了安全，不暴露未发布文章的存在
            detail=f"文章 ID {post_id} 不存在或未发布"
        )

    # 增加阅读量
    if increment_view:
        post.view_count += 1
        db.commit()
        db.refresh(post)
    
    return post

# ========== 获取单篇文章 ==========
@router.get("/{post_id}/", 
            response_model=PostResponse,
            summary="获取单篇文章",
            description="根据ID获取单篇文章的详细信息")
async def get_post(
    post_id: int,
    increment_view: bool = Query(False, description="是否增加阅读量"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),#添加当前用户依赖
):
    """
    获取单篇文章
    
    - **post_id**: 文章ID
    - **increment_view**: 是否增加阅读量计数
    """
    
    # 使用DataScope检查文章所有权（同时处理存在性检查）
    post = DataScope.check_post_ownership(post_id, current_user, db)

    # 增加阅读量
    if increment_view:
        post.view_count += 1
        db.commit()
        db.refresh(post)
    
    return post









# ========== 更新文章 ==========
@router.put("/{post_id}/", 
            response_model=PostResponse,
            summary="更新文章",
            description="更新文章的标题、内容等信息")
async def update_post(
    post_id: int,
    post_data: PostUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_author_user),#添加当前用户依赖，需要作者权限
):
    """
    更新文章
    
    - **post_id**: 要更新的文章ID
    - 其他字段可选更新
    """
    
    # 获取文章
    post = db.query(Post).filter(Post.id == post_id).first()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"文章 ID {post_id} 不存在"
        )
    
    # 使用DataScope检查资源所有权
    DataScope.check_resource_ownership(post, current_user, "文章")
    
    # 更新字段（只更新提供了的字段）
    update_data = post_data.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        if field == "status" and isinstance(value, Enum):
            value = value.value
        setattr(post, field, value)
    
    if "content_markdown" in update_data:
      post.content_html = markdown_to_html(update_data["content_markdown"])
    
    # 如果没有提供封面图片，自动生成
    if "cover_image" not in update_data and not post.cover_image:
        # 使用当前的标题和内容生成封面图片
        cover_image_path = generate_cover_image(
            title=post.title,
            content=post.content_markdown
        )
        if cover_image_path:
            post.cover_image = cover_image_path
    
    # 保存更改
    db.commit()
    db.refresh(post)
    
    return post




# ========== 删除文章 ==========
@router.delete("/{post_id}/", 
               status_code=status.HTTP_204_NO_CONTENT,
               summary="删除文章",
               description="根据ID删除文章")
async def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user), # 改为 get_current_user 以允许管理员
):
    """
    删除文章
    
    - **post_id**: 要删除的文章ID
    """
    
    # 获取文章
    post = db.query(Post).filter(Post.id == post_id).first()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"文章 ID {post_id} 不存在"
        )
    
    # 使用DataScope检查资源所有权 (管理员可删除任意文章)
    DataScope.check_resource_ownership(post, current_user, "文章")
    
    # 删除文章
    db.delete(post)
    db.commit()
    
    # 返回204 No Content
    return None