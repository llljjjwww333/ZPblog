from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class FriendResponse(BaseModel):
    id: int
    user_id: int
    friend_id: int
    status: str
    created_at: datetime
    friend_info: Optional[dict] = None
    
    class Config:
        from_attributes = True

class FriendCreate(BaseModel):
    friend_id: int

class FriendUpdate(BaseModel):
    status: str  # accepted 或 rejected

class UserSimpleResponse(BaseModel):
    id: int
    username: str
    nickname: Optional[str] = None
    avatar: Optional[str] = None
    
    class Config:
        from_attributes = True

class FriendRequestResponse(BaseModel):
    id: int
    user_id: int
    friend_id: int
    status: str
    created_at: datetime
    requester: Optional[UserSimpleResponse] = None
    
    class Config:
        from_attributes = True

class FriendListResponse(BaseModel):
    id: int
    friend: UserSimpleResponse
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True
