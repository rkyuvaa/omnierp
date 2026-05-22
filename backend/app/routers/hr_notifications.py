from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.models import User
from app.auth import get_current_user
from app.hr_models import HRNotification

router = APIRouter()

@router.get("/")
def get_notifications(
    user_id: int,
    unread_only: bool = False,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_superadmin:
        user_id = current_user.id
    q = db.query(HRNotification).filter(HRNotification.user_id == user_id)
    if unread_only:
        q = q.filter(HRNotification.is_read == False)
    notifications = q.order_by(HRNotification.created_at.desc()).limit(limit).all()
    return [{
        "id": n.id, "title": n.title, "message": n.message,
        "notif_type": n.notif_type, "reference_type": n.reference_type,
        "reference_id": n.reference_id, "is_read": n.is_read,
        "created_at": str(n.created_at),
    } for n in notifications]

@router.get("/unread-count")
def unread_count(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_superadmin:
        user_id = current_user.id
    count = db.query(HRNotification).filter(
        HRNotification.user_id == user_id,
        HRNotification.is_read == False
    ).count()
    return {"count": count}

@router.post("/{notif_id}/read")
def mark_read(notif_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    notif = db.query(HRNotification).filter(HRNotification.id == notif_id).first()
    if notif:
        if not current_user.is_superadmin and notif.user_id != current_user.id:
            raise HTTPException(403, "Not authorized to read this notification")
        notif.is_read = True
        db.commit()
    return {"message": "Marked as read"}

@router.post("/mark-all-read")
def mark_all_read(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_superadmin:
        user_id = current_user.id
    db.query(HRNotification).filter(
        HRNotification.user_id == user_id,
        HRNotification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"message": "All marked as read"}
