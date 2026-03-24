from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.crud import notification as crud_notification
from app.schemas.notification import Notification
from app.api.auth.dependencies import get_current_active_user
from app.model.user import User

router = APIRouter()

@router.get("/", response_model=List[Notification])
def read_notifications(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    notifications = crud_notification.get_notifications(db, user_id=current_user.id, skip=skip, limit=limit)
    return notifications

@router.get("/unread-count", response_model=int)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    return crud_notification.get_unread_count(db, user_id=current_user.id)

@router.put("/{notification_id}/read", response_model=Notification)
def mark_notification_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    notification = crud_notification.mark_as_read(db, notification_id=notification_id, user_id=current_user.id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    return notification

@router.put("/read-all", response_model=bool)
def mark_all_notifications_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    return crud_notification.mark_all_as_read(db, user_id=current_user.id)

@router.delete("/delete-all", response_model=bool)
def delete_all_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    return crud_notification.delete_all_notifications(db, user_id=current_user.id)
