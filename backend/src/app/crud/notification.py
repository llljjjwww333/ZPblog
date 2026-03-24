from sqlalchemy.orm import Session
from app.model.notification import Notification
from app.schemas.notification import NotificationUpdate

def get_notifications(db: Session, user_id: int, skip: int = 0, limit: int = 10):
    return db.query(Notification)\
        .filter(Notification.recipient_id == user_id)\
        .order_by(Notification.created_at.desc())\
        .offset(skip)\
        .limit(limit)\
        .all()

def get_unread_count(db: Session, user_id: int):
    return db.query(Notification)\
        .filter(Notification.recipient_id == user_id, Notification.is_read == False)\
        .count()

def create_notification(db: Session, notification: Notification):
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification

def mark_as_read(db: Session, notification_id: int, user_id: int):
    notification = db.query(Notification).filter(Notification.id == notification_id, Notification.recipient_id == user_id).first()
    if notification:
        notification.is_read = True
        db.commit()
        db.refresh(notification)
    return notification

def mark_all_as_read(db: Session, user_id: int):
    db.query(Notification)\
        .filter(Notification.recipient_id == user_id, Notification.is_read == False)\
        .update({Notification.is_read: True}, synchronize_session=False)
    db.commit()
    return True

def delete_all_notifications(db: Session, user_id: int):
    db.query(Notification)\
        .filter(Notification.recipient_id == user_id)\
        .delete(synchronize_session=False)
    db.commit()
    return True
