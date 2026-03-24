from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional
from app.model.message import Message
from app.schemas.message import MessageCreate, MessageResponse

def create_message(db: Session, sender_id: int, receiver_id: int, content: str):
    """发送消息"""
    message = Message(
        sender_id=sender_id,
        receiver_id=receiver_id,
        content=content,
        is_read="0"
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message

def get_messages(db: Session, user_id: int, friend_id: int, skip: int = 0, limit: int = 50):
    """获取与特定好友的聊天记录"""
    return db.query(Message).filter(
        or_(
            and_(Message.sender_id == user_id, Message.receiver_id == friend_id),
            and_(Message.sender_id == friend_id, Message.receiver_id == user_id)
        )
    ).order_by(Message.created_at.desc()).offset(skip).limit(limit).all()

def get_unread_count(db: Session, user_id: int):
    """获取未读消息数量"""
    return db.query(Message).filter(
        and_(Message.receiver_id == user_id, Message.is_read == "0")
    ).count()

def mark_as_read(db: Session, message_id: int, user_id: int):
    """标记消息为已读"""
    message = db.query(Message).filter(
        and_(Message.id == message_id, Message.receiver_id == user_id)
    ).first()
    
    if message:
        message.is_read = "1"
        db.commit()
        db.refresh(message)
    return message

def mark_all_as_read(db: Session, user_id: int, friend_id: int):
    """标记与特定好友的所有消息为已读"""
    db.query(Message).filter(
        and_(
            Message.sender_id == friend_id,
            Message.receiver_id == user_id,
            Message.is_read == "0"
        )
    ).update({"is_read": "1"})
    db.commit()

def get_conversations(db: Session, user_id: int):
    """获取所有会话列表（每个好友的最后一条消息）"""
    # 获取所有与用户相关的好友ID
    from app.model.friend import Friend, FriendStatus
    from sqlalchemy import or_
    
    friends = db.query(Friend).filter(
        or_(
            and_(Friend.user_id == user_id, Friend.status == FriendStatus.ACCEPTED),
            and_(Friend.friend_id == user_id, Friend.status == FriendStatus.ACCEPTED)
        )
    ).all()
    
    conversations = []
    for friend in friends:
        friend_user_id = friend.friend_id if friend.user_id == user_id else friend.user_id
        
        # 获取最后一条消息
        last_message = db.query(Message).filter(
            or_(
                and_(Message.sender_id == user_id, Message.receiver_id == friend_user_id),
                and_(Message.sender_id == friend_user_id, Message.receiver_id == user_id)
            )
        ).order_by(Message.created_at.desc()).first()
        
        # 获取未读消息数量
        unread_count = db.query(Message).filter(
            and_(
                Message.sender_id == friend_user_id,
                Message.receiver_id == user_id,
                Message.is_read == "0"
            )
        ).count()
        
        conversations.append({
            "friend_id": friend_user_id,
            "last_message": last_message,
            "unread_count": unread_count
        })
    
    # 按最后消息时间排序
    conversations.sort(key=lambda x: x["last_message"].created_at if x["last_message"] else 0, reverse=True)
    return conversations
