from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class MessageCreate(BaseModel):
    receiver_id: int
    content: str

class MessageResponse(BaseModel):
    id: int
    sender_id: int
    receiver_id: int
    content: str
    is_read: str
    created_at: datetime
    sender: Optional[dict] = None
    receiver: Optional[dict] = None
    warning: Optional[str] = None  # 警告信息，如"你已被对方删除"

    class Config:
        from_attributes = True

class ConversationResponse(BaseModel):
    friend_id: int
    friend_info: Optional[dict] = None
    last_message: Optional[MessageResponse] = None
    unread_count: int

class ChatHistoryResponse(BaseModel):
    messages: list
    total: int
