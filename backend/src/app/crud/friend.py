from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional
from app.model.friend import Friend, FriendStatus
from app.model.user import User
from app.schemas.friend import FriendCreate, FriendUpdate, FriendResponse

def get_friends(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    """获取用户的所有好友（排除已被当前用户删除的）"""
    # 只要是 ACCEPTED 状态且与用户相关的记录
    return db.query(Friend).filter(
        and_(
            Friend.status == FriendStatus.ACCEPTED,
            or_(
                Friend.user_id == user_id,
                Friend.friend_id == user_id
            )
        )
    ).order_by(Friend.created_at.desc()).offset(skip).limit(limit).all()

def get_friend_requests(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    """获取用户收到的好友请求"""
    return db.query(Friend).filter(
        and_(Friend.friend_id == user_id, Friend.status == FriendStatus.PENDING)
    ).offset(skip).limit(limit).all()

def get_sent_requests(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    """获取用户发送的好友请求"""
    return db.query(Friend).filter(
        and_(Friend.user_id == user_id, Friend.status == FriendStatus.PENDING)
    ).offset(skip).limit(limit).all()

def create_friend_request(db: Session, requester_id: int, friend_id: int):
    """发送好友请求"""
    # 检查是否已经存在有效的关系（待处理或已接受）
    existing = db.query(Friend).filter(
        and_(
            or_(
                and_(Friend.user_id == requester_id, Friend.friend_id == friend_id),
                and_(Friend.user_id == friend_id, Friend.friend_id == requester_id)
            ),
            Friend.status.in_([FriendStatus.PENDING, FriendStatus.ACCEPTED])
        )
    ).first()
    
    if existing:
        return None
    
    friend = Friend(user_id=requester_id, friend_id=friend_id, status=FriendStatus.PENDING)
    db.add(friend)
    db.commit()
    db.refresh(friend)
    return friend

def accept_friend_request(db: Session, request_id: int, user_id: int):
    """接受好友请求"""
    friend_request = db.query(Friend).filter(
        and_(Friend.id == request_id, Friend.friend_id == user_id, Friend.status == FriendStatus.PENDING)
    ).first()
    
    if not friend_request:
        return None
    
    friend_request.status = FriendStatus.ACCEPTED
    db.commit()
    db.refresh(friend_request)
    return friend_request

def reject_friend_request(db: Session, request_id: int, user_id: int):
    """拒绝好友请求"""
    friend_request = db.query(Friend).filter(
        and_(Friend.id == request_id, Friend.friend_id == user_id, Friend.status == FriendStatus.PENDING)
    ).first()
    
    if not friend_request:
        return None
    
    friend_request.status = FriendStatus.REJECTED
    db.commit()
    db.refresh(friend_request)
    return friend_request

def delete_friend(db: Session, user_id: int, friend_id: int):
    """删除好友（软删除）"""
    # 找到好友关系（不检查删除状态，允许删除已被对方删除的好友）
    friend_relation = db.query(Friend).filter(
        and_(
            or_(
                and_(Friend.user_id == user_id, Friend.friend_id == friend_id),
                and_(Friend.user_id == friend_id, Friend.friend_id == user_id)
            ),
            Friend.status == FriendStatus.ACCEPTED
        )
    ).first()

    if not friend_relation:
        return False

    # 确保字段不为NULL（处理旧数据）
    if friend_relation.deleted_by_user is None:
        friend_relation.deleted_by_user = False
    if friend_relation.deleted_by_friend is None:
        friend_relation.deleted_by_friend = False

    # 软删除：标记删除状态
    if friend_relation.user_id == user_id:
        # 当前用户是发起人
        friend_relation.deleted_by_user = True
    else:
        # 当前用户是接收人
        friend_relation.deleted_by_friend = True

    # 如果双方都删除了，则真正删除记录
    if friend_relation.deleted_by_user and friend_relation.deleted_by_friend:
        db.delete(friend_relation)

    db.commit()
    return True

def get_friend_status(db: Session, user_id: int, target_user_id: int):
    """检查两个用户之间的关系状态"""
    # 查询两个用户之间的所有好友关系，按创建时间倒序排序
    friend_relations = db.query(Friend).filter(
        or_(
            and_(Friend.user_id == user_id, Friend.friend_id == target_user_id),
            and_(Friend.user_id == target_user_id, Friend.friend_id == user_id)
        )
    ).order_by(Friend.created_at.desc()).all()
    
    # 遍历所有好友关系，返回最新的未被删除的好友关系
    for relation in friend_relations:
        # 检查是否被当前用户删除
        is_deleted_by_current = False
        if relation.user_id == user_id:
            is_deleted_by_current = relation.deleted_by_user or False
        else:
            is_deleted_by_current = relation.deleted_by_friend or False
        
        # 如果未被当前用户删除，返回该好友关系
        if not is_deleted_by_current:
            return relation
    
    # 如果没有未被删除的好友关系，返回None
    return None

def search_users(db: Session, username: str, current_user_id: int, skip: int = 0, limit: int = 20):
    """搜索用户"""
    return db.query(User).filter(
        and_(
            User.username.contains(username),
            User.id != current_user_id
        )
    ).offset(skip).limit(limit).all()

def get_user_friends_with_info(db: Session, user_id: int):
    """获取用户好友列表，包含详细信息"""
    friends = get_friends(db, user_id)
    result = []
    for friend in friends:
        # 确定好友ID
        friend_user_id = friend.friend_id if friend.user_id == user_id else friend.user_id
        friend_user = db.query(User).filter(User.id == friend_user_id).first()
        if friend_user:
            result.append({
                "id": friend.id,
                "friend": {
                    "id": friend_user.id,
                    "username": friend_user.username,
                    "nickname": friend_user.nickname,
                    "avatar": friend_user.avatar
                },
                "status": friend.status,
                "created_at": friend.created_at
            })
    return result
