from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.schemas.post import PostSimple
from app.schemas.user import UserSimple
from app.schemas.friend import FriendResponse

class NotificationBase(BaseModel):
    pass

class NotificationUpdate(BaseModel):
    is_read: bool

class Notification(BaseModel):
    id: int
    recipient_id: int
    sender_id: int
    post_id: Optional[int] = None
    comment_id: Optional[int] = None
    friend_request_id: Optional[int] = None
    content: Optional[str] = None # 新增
    type: Optional[str] = None # 新增
    is_read: bool
    created_at: datetime
    
    # 嵌套信息，用于前端展示
    sender: Optional[UserSimple] = None
    post: Optional[PostSimple] = None
    friend_request: Optional[FriendResponse] = None
    
    class Config:
        from_attributes = True
