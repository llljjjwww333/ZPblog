from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from .user import UserSimple

class CommentBase(BaseModel):
    content: str
    is_anonymous: bool = False

class CommentCreate(CommentBase):
    pass

class CommentUpdate(BaseModel):
    content: Optional[str] = None

class CommentResponse(CommentBase):
    id: int
    post_id: int
    author_id: int
    created_at: datetime
    likes: int
    author: Optional[UserSimple] = None

    class Config:
        from_attributes = True
