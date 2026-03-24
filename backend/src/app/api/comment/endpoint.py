from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.model.comment import Comment
from app.model.post import Post
from app.model.user import User
from app.model.notification import Notification
from app.schemas.comment import CommentCreate, CommentResponse
from app.api.auth.dependencies import get_current_user
from app.schemas.post import PostStatus

router = APIRouter(prefix="/comments", tags=["comments"])

@router.get("/post/{post_id}", response_model=List[CommentResponse])
async def get_post_comments(
    post_id: int,
    db: Session = Depends(get_db)
):
    """
    获取文章的所有评论
    """
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="文章不存在")
        
    comments = db.query(Comment).filter(Comment.post_id == post_id).order_by(Comment.created_at.desc()).all()
    return comments

@router.post("/post/{post_id}", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def create_comment(
    post_id: int,
    comment_data: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    创建评论
    """
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="文章不存在")
    
    # 创建评论
    new_comment = Comment(
        content=comment_data.content,
        post_id=post_id,
        author_id=current_user.id,
        is_anonymous=comment_data.is_anonymous
    )
    
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)
    
    # 触发通知逻辑：如果评论者不是文章作者，则给文章作者发送通知
    if current_user.id != post.author_id:
        new_notification = Notification(
            recipient_id=post.author_id,
            sender_id=current_user.id,
            post_id=post.id,
            comment_id=new_comment.id,
            is_read=False
        )
        db.add(new_notification)
        db.commit()
        
        # 通过WebSocket发送实时通知
        try:
            import sys
            import os
            sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
            from main import manager
            
            await manager.send_personal_message(
                {
                    "type": "new_notification",
                    "notification": {
                        "id": new_notification.id,
                        "sender_id": current_user.id,
                        "recipient_id": post.author_id,
                        "post_id": post.id,
                        "comment_id": new_comment.id,
                        "is_read": False,
                        "created_at": new_notification.created_at.isoformat() if hasattr(new_notification.created_at, 'isoformat') else str(new_notification.created_at),
                        "sender": {
                            "id": current_user.id,
                            "username": current_user.username,
                            "nickname": current_user.nickname,
                            "avatar": current_user.avatar
                        },
                        "post": {
                            "id": post.id,
                            "title": post.title
                        }
                    }
                },
                post.author_id
            )
        except Exception as e:
            print(f"WebSocket通知失败: {e}")
        
    return new_comment

@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    删除评论
    - 作者可以删除自己的评论
    - 管理员可以删除任何评论
    - 文章作者可以删除自己文章下的评论
    """
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="评论不存在")
    
    # 检查权限
    # 1. 评论作者
    # 2. 管理员
    # 3. 文章作者
    post = db.query(Post).filter(Post.id == comment.post_id).first()
    is_post_author = post and post.author_id == current_user.id
    
    if (
        comment.author_id != current_user.id 
        and current_user.role != "admin" 
        and not is_post_author
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权删除该评论"
        )
    
    db.delete(comment)
    db.commit()
    return None
