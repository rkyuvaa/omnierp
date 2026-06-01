from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.models import User
from app.auth import get_current_user
from app.hr_models import HRNotification, HRFcmToken
from app.fcm import send_fcm_multicast

router = APIRouter()

# ── Helper called from every module that creates notifications ──
def dispatch_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    notif_type: str = "info",
    reference_type: str = None,
    reference_id: int = None,
):
    """
    Creates an in-app HRNotification row AND fires FCM push to all
    registered Android devices of that user (if Firebase is configured).
    """
    # 1. Save in-app notification (always works)
    notif = HRNotification(
        user_id=user_id,
        title=title,
        message=message,
        notif_type=notif_type,
        reference_type=reference_type,
        reference_id=reference_id,
        is_read=False,
    )
    db.add(notif)

    # 2. Fetch user's Android device tokens and send FCM push
    tokens = db.query(HRFcmToken.token).filter(HRFcmToken.user_id == user_id).all()
    if tokens:
        token_list = [t[0] for t in tokens]
        data_payload = {}
        if reference_type:
            data_payload["type"] = reference_type
        if reference_id:
            data_payload["id"] = str(reference_id)

        send_fcm_multicast(
            device_tokens=token_list,
            title=title,
            body=message,
            data=data_payload,
        )


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
        "created_at": n.created_at.isoformat() + "Z" if n.created_at else None,
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
