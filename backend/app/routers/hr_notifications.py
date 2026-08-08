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

    # 3. Fire Web Push (PWA) and standard push notifications via push_service
    try:
        from app.utils.push_service import send_push_to_user
        send_push_to_user(
            user_id=user_id,
            title=title,
            message=message,
            reference_type=reference_type,
            reference_id=reference_id,
            db=db
        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Failed to send web/standard push to user {user_id}: {e}")


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

from pydantic import BaseModel
from typing import List

class CustomNotificationRequest(BaseModel):
    title: str
    message: str
    target_type: str  # "all", "selective", "specific"
    branch_ids: Optional[List[int]] = None
    department_ids: Optional[List[int]] = None
    categories: Optional[List[str]] = None
    employee_ids: Optional[List[int]] = None

@router.post("/send-custom")
def send_custom_notification(
    data: CustomNotificationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.auth import is_hr_admin
    if not is_hr_admin(current_user, db):
        raise HTTPException(status_code=403, detail="Access denied. Only HR Admin can send custom notifications.")

    from app.hr_models import HREmployee
    q = db.query(HREmployee).filter(HREmployee.is_active == True)

    if data.target_type == "specific":
        if not data.employee_ids:
            raise HTTPException(status_code=400, detail="No employees selected.")
        q = q.filter(HREmployee.id.in_(data.employee_ids))
    elif data.target_type == "selective":
        has_filter = False
        if data.branch_ids:
            q = q.filter(HREmployee.branch_id.in_(data.branch_ids))
            has_filter = True
        if data.department_ids:
            q = q.filter(HREmployee.department_id.in_(data.department_ids))
            has_filter = True
        if data.categories:
            q = q.filter(HREmployee.salary_category.in_(data.categories))
            has_filter = True
        
        if not has_filter:
            raise HTTPException(status_code=400, detail="Please select at least one branch, department, or category.")

    employees = q.all()
    user_ids = {emp.user_id for emp in employees if emp.user_id is not None}

    if not user_ids:
        return {"sent_count": 0, "message": "No active users found matching the selected criteria."}

    sent_count = 0
    for uid in user_ids:
        dispatch_notification(
            db=db,
            user_id=uid,
            title=data.title,
            message=data.message,
            notif_type="broadcast",
        )
        sent_count += 1

    db.commit()
    return {"sent_count": sent_count, "message": f"Successfully sent notifications to {sent_count} user(s)."}
