"""
好友关系数据模型
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base
import enum

class FriendStatus(str, enum.Enum):
    PENDING = "pending"   # 申请中
    ACCEPTED = "accepted" # 已接受
    REJECTED = "rejected" # 已拒绝

class Friend(Base):
    """好友关系模型"""
    __tablename__ = "friends"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)     # 发起人
    friend_id = Column(Integer, ForeignKey("users.id"), nullable=False)   # 接收人
    status = Column(String(20), default=FriendStatus.PENDING)
    deleted_by_user = Column(Boolean, default=False)   # 发起人是否删除
    deleted_by_friend = Column(Boolean, default=False) # 接收人是否删除
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 关系
    user = relationship("User", foreign_keys=[user_id], backref="friend_requests_sent")
    friend = relationship("User", foreign_keys=[friend_id], backref="friend_requests_received")
