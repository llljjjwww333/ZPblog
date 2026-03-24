from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from app.database import get_db
from app.model.user import User
from app.model.post import Post
from app.api.auth.dependencies import get_current_admin_user
from datetime import datetime, date
from typing import List, Optional
from pydantic import BaseModel

router = APIRouter(prefix="/admin", tags=["admin"])

# --- Schema Definitions ---

class UserAdminView(BaseModel):
    id: int
    username: str
    email: str
    nickname: Optional[str] = None
    role: str
    is_active: bool
    can_post: bool
    created_at: datetime
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True

class PaginatedUsers(BaseModel):
    items: List[UserAdminView]
    total: int
    page: int
    size: int
    pages: int

class UserStatusUpdate(BaseModel):
    can_post: Optional[bool] = None
    is_active: Optional[bool] = None

class PostAdminView(BaseModel):
    id: int
    title: str
    author: str
    status: str
    created_at: datetime
    view_count: int
    category_id: Optional[int] = None

class PaginatedPosts(BaseModel):
    items: List[PostAdminView]
    total: int
    page: int
    size: int
    pages: int

from app.model.comment import Comment

class PostStatusUpdate(BaseModel):
    status: str # 'published', 'draft', 'archived'

class CommentAdminView(BaseModel):
    id: int
    content: str
    post_title: str
    author: str
    created_at: datetime
    likes: int

class PaginatedComments(BaseModel):
    items: List[CommentAdminView]
    total: int
    page: int
    size: int
    pages: int

# --- Endpoints ---

@router.get("/comments", response_model=PaginatedComments)
async def get_comments_list(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    管理员获取评论列表
    """
    query = db.query(Comment).join(User, Comment.author_id == User.id).join(Post, Comment.post_id == Post.id)
    
    if search:
        query = query.filter(Comment.content.ilike(f"%{search}%"))
    
    total = query.count()
    comments = query.order_by(desc(Comment.created_at)).offset((page - 1) * size).limit(size).all()
    
    # 转换为视图模型
    comment_list = []
    for comment in comments:
        comment_list.append({
            "id": comment.id,
            "content": comment.content,
            "post_title": comment.post.title,
            "author": comment.author.nickname or comment.author.username,
            "created_at": comment.created_at,
            "likes": comment.likes
        })

    return {
        "items": comment_list,
        "total": total,
        "page": page,
        "size": size,
        "pages": (total + size - 1) // size
    }

@router.delete("/comments/{comment_id}")
async def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    管理员删除评论
    """
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="评论不存在")
        
    db.delete(comment)
    db.commit()
    return None

from app.model.notification import Notification

class SystemAnnouncement(BaseModel):
    content: str

@router.post("/announcements")
async def create_system_announcement(
    announcement: SystemAnnouncement,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    发布系统公告 (发送给所有用户)
    """
    # 获取所有用户
    users = db.query(User).all()
    
    # 为每个用户创建通知
    notifications = []
    for user in users:
        # 跳过管理员自己（可选）
        if user.id == current_user.id:
            continue
            
        notification = Notification(
            recipient_id=user.id,
            sender_id=current_user.id,
            type="system", # 需要确保Notification模型支持此类型，或者使用其他通用类型
            content=announcement.content,
            is_read=False
        )
        notifications.append(notification)
    
    if notifications:
        db.add_all(notifications)
        db.commit()
        
        # 获取 manager 实例并广播消息
        from app.core.socket import manager
        
        # 广播给所有在线用户
        for user_id in manager.active_connections.keys():
            # 找到该用户的 notification
            user_notif = next((n for n in notifications if n.recipient_id == user_id), None)
            
            if user_notif:
                # 构建消息内容
                message_data = {
                    "type": "new_notification",
                    "notification": {
                        "id": user_notif.id if user_notif.id else 0,
                        "recipient_id": user_id,
                        "sender_id": current_user.id,
                        "content": announcement.content,
                        "type": "system",
                        "is_read": False,
                        "created_at": user_notif.created_at.isoformat() if user_notif.created_at else datetime.now().isoformat(),
                        "sender": {
                            "id": current_user.id,
                            "username": current_user.username,
                            "nickname": current_user.nickname,
                            "avatar_url": current_user.avatar
                        }
                    }
                }
                
                # 发送 WebSocket 消息
                # 注意：FastAPI 的 WebSocket 发送是异步的
                # 但在一个普通 async def 路由中，我们可以直接 await
                try:
                    await manager.send_personal_message(message_data, user_id)
                except Exception as e:
                    print(f"Failed to send system announcement to user {user_id}: {e}")

    return {"message": f"成功向 {len(notifications)} 位用户发送系统公告"}

@router.get("/posts", response_model=PaginatedPosts)
async def get_posts_list(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    管理员获取文章列表
    """
    query = db.query(Post).join(User, Post.author_id == User.id)
    
    if search:
        query = query.filter(Post.title.ilike(f"%{search}%"))
        
    if status_filter:
        query = query.filter(Post.status == status_filter)
    
    total = query.count()
    posts = query.order_by(desc(Post.created_at)).offset((page - 1) * size).limit(size).all()
    
    # 转换为视图模型
    post_list = []
    for post in posts:
        post_list.append({
            "id": post.id,
            "title": post.title,
            "author": post.author.nickname or post.author.username,
            "status": post.status,
            "created_at": post.created_at,
            "view_count": post.view_count,
            "category_id": post.category_id
        })

    return {
        "items": post_list,
        "total": total,
        "page": page,
        "size": size,
        "pages": (total + size - 1) // size
    }

@router.put("/posts/{post_id}/status")
async def update_post_status(
    post_id: int,
    status_update: PostStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    管理员更新文章状态 (例如屏蔽文章 -> 设为草稿或归档)
    """
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="文章不存在")
        
    post.status = status_update.status
    db.commit()
    db.refresh(post)
    return post

@router.delete("/posts/{post_id}")
async def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    管理员删除文章
    """
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="文章不存在")
        
    db.delete(post)
    db.commit()
    return None

@router.get("/users", response_model=PaginatedUsers)
async def get_users_list(
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    管理员获取用户列表
    """
    query = db.query(User)
    
    if search:
        query = query.filter(
            (User.username.ilike(f"%{search}%")) |
            (User.email.ilike(f"%{search}%")) |
            (User.nickname.ilike(f"%{search}%"))
        )
    
    total = query.count()
    users = query.order_by(desc(User.created_at)).offset((page - 1) * size).limit(size).all()
    
    # 确保 users 是一个列表，并且每个元素都可以转换为 UserAdminView
    # 如果数据库中 can_post 为 NULL，需要提供默认值
    user_list = []
    for user in users:
        # 手动处理可能的 None 值，确保符合 Pydantic 模型
        user_dict = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "nickname": user.nickname,
            "role": user.role,
            "is_active": user.is_active if user.is_active is not None else True,
            "can_post": user.can_post if user.can_post is not None else True,
            "created_at": user.created_at,
            "last_login": user.last_login
        }
        user_list.append(user_dict)

    return {
        "items": user_list,
        "total": total,
        "page": page,
        "size": size,
        "pages": (total + size - 1) // size
    }

@router.put("/users/{user_id}/status")
async def update_user_status(
    user_id: int,
    status_update: UserStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    管理员更新用户状态 (禁言/解禁, 封号/解封)
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
        
    if user.is_superuser:
        raise HTTPException(status_code=403, detail="无法修改管理员状态")
    
    if status_update.can_post is not None:
        user.can_post = status_update.can_post
        
    if status_update.is_active is not None:
        user.is_active = status_update.is_active
        
    db.commit()
    db.refresh(user)
    return user

@router.get("/stats")
async def get_admin_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    获取管理员仪表盘统计数据
    """
    # 总用户数
    total_users = db.query(User).count()
    
    # 总文章数
    total_posts = db.query(Post).count()
    
    # 今日新增文章 (作为今日活跃度的一个指标)
    today = date.today()
    today_posts = db.query(Post).filter(func.date(Post.created_at) == today).count()
    
    # 总阅读量
    total_views = db.query(func.sum(Post.view_count)).scalar() or 0

    # --- 1. 获取近7天的访问趋势数据 ---
    # 由于我们目前没有专门的 DailyVisit 表，这里我们用"近7天发布的文章数"来模拟趋势
    # 或者如果 Post 表有 updated_at，也可以用它。
    # 为了演示效果，我们查询近7天每天发布的文章数量作为趋势数据
    from datetime import timedelta
    
    trend_data = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        count = db.query(Post).filter(func.date(Post.created_at) == day).count()
        trend_data.append({
            "name": day.strftime("%m-%d"),
            "views": count # 这里暂时用文章发布数代替访问量趋势，因为没有访问日志表
        })

    # --- 2. 获取真实的分类占比数据 ---
    # 统计每个分类下的文章数量
    from app.model.category import Category
    
    category_stats = db.query(
        Category.name, 
        func.count(Post.id)
    ).outerjoin(Post, Category.id == Post.category_id)\
     .group_by(Category.id)\
     .all()
    
    pie_data = [{"name": name, "value": count} for name, count in category_stats if count > 0]
    
    # 如果没有分类数据，或者有未分类的文章
    uncategorized_count = db.query(Post).filter(Post.category_id == None).count()
    if uncategorized_count > 0:
        pie_data.append({"name": "未分类", "value": uncategorized_count})

    # --- 3. 获取今日热度榜 (Top 5 阅读量文章) ---
    # 由于没有每日阅读量增量数据，这里暂时返回总阅读量最高的5篇文章
    top_posts = db.query(Post).order_by(desc(Post.view_count)).limit(5).all()
    
    hot_posts = []
    for post in top_posts:
        hot_posts.append({
            "id": post.id,
            "title": post.title,
            "views": post.view_count
        })

    return {
        "total_users": total_users,
        "total_posts": total_posts,
        "today_posts": today_posts,
        "total_views": total_views,
        "trend_data": trend_data,
        "pie_data": pie_data,
        "hot_posts": hot_posts
    }
