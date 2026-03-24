from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.crud import friend as friend_crud
from app.schemas.friend import (
    FriendCreate, FriendUpdate, FriendResponse, 
    FriendRequestResponse, FriendListResponse, UserSimpleResponse
)
from app.api.auth.dependencies import get_current_active_user
from app.model.user import User

router = APIRouter(prefix="/friends", tags=["friends"])

@router.get("/", response_model=List[dict])
def get_friends(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取所有好友列表"""
    friends = friend_crud.get_user_friends_with_info(db, current_user.id)
    return friends

@router.get("/requests", response_model=List[FriendRequestResponse])
def get_friend_requests(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取收到的好友请求"""
    requests = friend_crud.get_friend_requests(db, current_user.id, skip, limit)
    result = []
    for req in requests:
        requester = db.query(User).filter(User.id == req.user_id).first()
        result.append({
            "id": req.id,
            "user_id": req.user_id,
            "friend_id": req.friend_id,
            "status": req.status,
            "created_at": req.created_at,
            "requester": {
                "id": requester.id,
                "username": requester.username,
                "nickname": requester.nickname,
                "avatar": requester.avatar
            } if requester else None
        })
    return result

@router.get("/sent", response_model=List[FriendResponse])
def get_sent_requests(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取已发送的好友请求"""
    return friend_crud.get_sent_requests(db, current_user.id, skip, limit)

@router.post("/add", response_model=dict)
async def send_friend_request(
    request: FriendCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """发送好友请求"""
    # 不能添加自己
    if request.friend_id == current_user.id:
        raise HTTPException(status_code=400, detail="不能添加自己为好友")
    
    # 检查用户是否存在
    target_user = db.query(User).filter(User.id == request.friend_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    # 发送请求 - 修改逻辑：如果已存在但状态不是 PENDING/ACCEPTED，允许重新发送
    # 先查询现有关系
    from app.model.friend import Friend, FriendStatus
    from sqlalchemy import and_, or_
    
    existing = db.query(Friend).filter(
        or_(
            and_(Friend.user_id == current_user.id, Friend.friend_id == request.friend_id),
            and_(Friend.user_id == request.friend_id, Friend.friend_id == current_user.id)
        )
    ).first()
    
    if existing:
        # 如果已存在关系
        if existing.status == FriendStatus.ACCEPTED:
            raise HTTPException(status_code=400, detail="已经是好友了")
        elif existing.status == FriendStatus.PENDING:
            raise HTTPException(status_code=400, detail="好友请求已发送，请等待对方处理")
        elif existing.status == FriendStatus.REJECTED:
            # 如果被拒绝，允许重新发送（重置状态）
            existing.status = FriendStatus.PENDING
            existing.user_id = current_user.id # 确保当前用户是发起人
            existing.friend_id = request.friend_id
            # 重置删除状态
            existing.deleted_by_user = False
            existing.deleted_by_friend = False
            db.commit()
            return {"message": "好友请求已重新发送", "friend_id": request.friend_id}
        else:
            # 其他状态（如删除了），允许重新建立
            # 删除旧记录，创建新记录
            db.delete(existing)
            db.commit()
    
    # 创建新请求
    friend = friend_crud.create_friend_request(db, current_user.id, request.friend_id)
    if not friend:
        raise HTTPException(status_code=400, detail="发送请求失败")
    
    print(f"好友请求已发送给用户 {request.friend_id}")
    
    return {"message": "好友请求已发送", "friend_id": request.friend_id}

@router.post("/{request_id}/accept", response_model=dict)
def accept_friend_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """接受好友请求"""
    friend = friend_crud.accept_friend_request(db, request_id, current_user.id)
    if not friend:
        raise HTTPException(status_code=404, detail="请求不存在或已过期")
    
    return {"message": "已成为好友"}

@router.post("/{request_id}/reject", response_model=dict)
def reject_friend_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """拒绝好友请求"""
    friend = friend_crud.reject_friend_request(db, request_id, current_user.id)
    if not friend:
        raise HTTPException(status_code=404, detail="请求不存在或已过期")
    
    return {"message": "已拒绝请求"}

@router.delete("/{friend_id}", response_model=dict)
def delete_friend(
    friend_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """删除好友"""
    success = friend_crud.delete_friend(db, current_user.id, friend_id)
    if not success:
        raise HTTPException(status_code=404, detail="好友关系不存在")
    
    return {"message": "已删除好友"}

@router.get("/status/{target_user_id}", response_model=dict)
def get_friend_status(
    target_user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """检查与目标用户的关系状态"""
    from app.model.friend import FriendStatus
    
    status = friend_crud.get_friend_status(db, current_user.id, target_user_id)
    if not status:
        return {"status": "none"}
    
    # 检查是否被对方删除
    is_deleted_by_other = False
    if status.user_id == current_user.id:
        # 当前用户是发起人，检查是否被接收人删除
        is_deleted_by_other = status.deleted_by_friend or False
    else:
        # 当前用户是接收人，检查是否被发起人删除
        is_deleted_by_other = status.deleted_by_user or False
    
    if is_deleted_by_other:
        return {"status": "deleted_by_other", "request_id": status.id}
    
    return {"status": status.status, "request_id": status.id}

@router.get("/search", response_model=List[UserSimpleResponse])
def search_users(
    username: str,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """搜索用户"""
    users = friend_crud.search_users(db, username, current_user.id, skip, limit)
    return users
