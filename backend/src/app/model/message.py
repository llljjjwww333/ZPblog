"""
消息数据模型
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class Message(Base):
    """消息模型"""
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    is_read = Column(String(1), default="0")  # 0-未读 1-已读
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 关系
    sender = relationship("User", foreign_keys=[sender_id], backref="messages_sent")
    receiver = relationship("User", foreign_keys=[receiver_id], backref="messages_received")

    def __repr__(self):
        return f"<Message {self.id}: from {self.sender_id} to {self.receiver_id}>"
