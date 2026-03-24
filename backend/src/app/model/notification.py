from sqlalchemy import Column, Integer, Boolean, DateTime, ForeignKey, String
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # 接收者
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)     # 发送者
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=True)        # 关联文章（可选）
    comment_id = Column(Integer, ForeignKey("comments.id"), nullable=True)  # 关联评论（可选）
    friend_request_id = Column(Integer, ForeignKey("friends.id"), nullable=True)  # 关联好友请求（可选）
    content = Column(String, nullable=True) # 增加内容字段，用于系统通知等
    type = Column(String, nullable=True) # 增加类型字段：system, comment, like, etc.
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 关联关系
    recipient = relationship("User", foreign_keys=[recipient_id], backref="notifications_received")
    sender = relationship("User", foreign_keys=[sender_id], backref="notifications_sent")
    post = relationship("Post", foreign_keys=[post_id])
    comment = relationship("Comment")
    friend_request = relationship("Friend", foreign_keys=[friend_request_id])
