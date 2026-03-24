from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.crud import message as message_crud
from app.schemas.message import (
    MessageCreate, MessageResponse, ConversationResponse, ChatHistoryResponse
)
from app.api.auth.dependencies import get_current_active_user
from app.model.user import User

router = APIRouter(prefix="/messages", tags=["messages"])

@router.post("/send", response_model=MessageResponse)
async def send_message(
    message: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """发送消息"""
    # 检查是否是好友关系
    from app.crud import friend as friend_crud
    from app.model.friend import FriendStatus
    from app.core.socket import manager

    friend_status = friend_crud.get_friend_status(db, current_user.id, message.receiver_id)
    if not friend_status or friend_status.status != FriendStatus.ACCEPTED:
        raise HTTPException(status_code=403, detail="需要先添加对方为好友才能发送消息")

    # 检查是否被对方删除
    is_deleted_by_other = False
    if friend_status.user_id == current_user.id:
        # 当前用户是发起人，检查是否被接收人删除
        is_deleted_by_other = friend_status.deleted_by_friend or False
    else:
        # 当前用户是接收人，检查是否被发起人删除
        is_deleted_by_other = friend_status.deleted_by_user or False

    # 如果被对方删除，不能发送消息
    if is_deleted_by_other:
        raise HTTPException(status_code=403, detail="对方已删除好友关系，无法发送消息")

    # 创建消息
    new_message = message_crud.create_message(
        db, current_user.id, message.receiver_id, message.content
    )

    # 返回完整信息
    sender = db.query(User).filter(User.id == current_user.id).first()
    receiver = db.query(User).filter(User.id == message.receiver_id).first()

    response_data = {
        "id": new_message.id,
        "sender_id": new_message.sender_id,
        "receiver_id": new_message.receiver_id,
        "content": new_message.content,
        "is_read": new_message.is_read,
        "created_at": new_message.created_at.isoformat() if hasattr(new_message.created_at, 'isoformat') else str(new_message.created_at),
        "sender": {
            "id": sender.id,
            "username": sender.username,
            "nickname": sender.nickname,
            "avatar": sender.avatar
        } if sender else None,
        "receiver": {
            "id": receiver.id,
            "username": receiver.username,
            "nickname": receiver.nickname,
            "avatar": receiver.avatar
        } if receiver else None
    }

    # 如果被对方删除，添加警告信息
    if is_deleted_by_other:
        response_data["warning"] = "你已被对方删除"

    # 通过WebSocket推送消息给接收者
    await manager.send_personal_message(
        {
            "type": "new_message",
            "message": response_data
        },
        message.receiver_id
    )

    return response_data

@router.get("/conversations", response_model=List[ConversationResponse])
def get_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取所有会话列表"""
    conversations = message_crud.get_conversations(db, current_user.id)
    from app.model.user import User
    
    result = []
    for conv in conversations:
        friend_user = db.query(User).filter(User.id == conv["friend_id"]).first()
        result.append({
            "friend_id": conv["friend_id"],
            "friend_info": {
                "id": friend_user.id,
                "username": friend_user.username,
                "nickname": friend_user.nickname,
                "avatar": friend_user.avatar
            } if friend_user else None,
            "last_message": {
                "id": conv["last_message"].id,
                "sender_id": conv["last_message"].sender_id,
                "receiver_id": conv["last_message"].receiver_id,
                "content": conv["last_message"].content,
                "is_read": conv["last_message"].is_read,
                "created_at": conv["last_message"].created_at
            } if conv["last_message"] else None,
            "unread_count": conv["unread_count"]
        })
    
    return result

@router.get("/{friend_id}", response_model=ChatHistoryResponse)
def get_chat_history(
    friend_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取与特定好友的聊天记录"""
    # 检查是否是好友关系
    from app.crud import friend as friend_crud
    from app.model.friend import FriendStatus
    
    friend_status = friend_crud.get_friend_status(db, current_user.id, friend_id)
    if not friend_status or friend_status.status != FriendStatus.ACCEPTED:
        raise HTTPException(status_code=403, detail="需要先添加对方为好友才能查看聊天记录")
    
    # 检查是否被对方删除
    is_deleted_by_other = False
    if friend_status.user_id == current_user.id:
        # 当前用户是发起人，检查是否被接收人删除
        is_deleted_by_other = friend_status.deleted_by_friend or False
    else:
        # 当前用户是接收人，检查是否被发起人删除
        is_deleted_by_other = friend_status.deleted_by_user or False
    
    if is_deleted_by_other:
        raise HTTPException(status_code=403, detail="对方已删除好友关系，无法查看聊天记录")
    
    messages = message_crud.get_messages(db, current_user.id, friend_id, skip, limit)
    
    # 标记消息为已读
    message_crud.mark_all_as_read(db, current_user.id, friend_id)
    
    # 构建完整的消息列表
    message_list = []
    for msg in messages:
        sender = db.query(User).filter(User.id == msg.sender_id).first()
        message_list.append({
            "id": msg.id,
            "sender_id": msg.sender_id,
            "receiver_id": msg.receiver_id,
            "content": msg.content,
            "is_read": msg.is_read,
            "created_at": msg.created_at,
            "sender": {
                "id": sender.id,
                "username": sender.username,
                "nickname": sender.nickname,
                "avatar": sender.avatar
            } if sender else None,
            "receiver": None
        })
    
    return {
        "messages": message_list,
        "total": len(message_list)
    }

@router.get("/unread/count", response_model=int)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取未读消息总数"""
    return message_crud.get_unread_count(db, current_user.id)

@router.put("/{message_id}/read", response_model=dict)
def mark_message_as_read(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """标记单条消息为已读"""
    message = message_crud.mark_as_read(db, message_id, current_user.id)
    if not message:
        raise HTTPException(status_code=404, detail="消息不存在")
    
    return {"message": "已标记为已读"}
