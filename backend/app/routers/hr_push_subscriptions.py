from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models import User
from app.auth import get_current_user
from app.hr_models import HRPushSubscription, HRFcmToken
from app.config import settings

router = APIRouter()

# ── Web Push (VAPID) schemas ──────────────────────────────

class KeysSchema(BaseModel):
    p256dh: str
    auth: str

class SubscriptionSchema(BaseModel):
    endpoint: str
    keys: KeysSchema

class UnsubscribeSchema(BaseModel):
    endpoint: str

# ── FCM (Android native) schemas ─────────────────────────

class FcmTokenSchema(BaseModel):
    token: str
    device_label: Optional[str] = None

# ── Web Push endpoints ────────────────────────────────────

@router.get("/vapid-public-key")
def get_vapid_public_key(current_user: User = Depends(get_current_user)):
    """Return the server's VAPID public key so the browser PWA can subscribe."""
    return {"public_key": settings.VAPID_PUBLIC_KEY}

@router.post("/subscribe")
def subscribe(
    data: SubscriptionSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Save or update a Web Push subscription for the logged-in user."""
    sub = db.query(HRPushSubscription).filter(HRPushSubscription.endpoint == data.endpoint).first()
    if sub:
        sub.user_id = current_user.id
        sub.p256dh = data.keys.p256dh
        sub.auth = data.keys.auth
    else:
        sub = HRPushSubscription(
            user_id=current_user.id,
            endpoint=data.endpoint,
            p256dh=data.keys.p256dh,
            auth=data.keys.auth
        )
        db.add(sub)
    db.commit()
    return {"message": "Web Push subscription saved"}

@router.post("/unsubscribe")
def unsubscribe(
    data: UnsubscribeSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove a Web Push subscription."""
    sub = db.query(HRPushSubscription).filter(
        HRPushSubscription.endpoint == data.endpoint,
        HRPushSubscription.user_id == current_user.id
    ).first()
    if sub:
        db.delete(sub)
        db.commit()
        return {"message": "Unsubscribed successfully"}
    return {"message": "Subscription not found"}

# ── FCM Token endpoints (Android native push) ─────────────

@router.post("/fcm-token")
def register_fcm_token(
    data: FcmTokenSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Called by the Android app on login / token refresh.
    Saves or updates the FCM device token for the current user.
    """
    if not data.token or len(data.token) < 20:
        raise HTTPException(400, "Invalid FCM token")

    existing = db.query(HRFcmToken).filter(HRFcmToken.token == data.token).first()
    if existing:
        # Token might belong to another user (device re-use / reinstall)
        existing.user_id = current_user.id
        existing.device_label = data.device_label
    else:
        row = HRFcmToken(
            user_id=current_user.id,
            token=data.token,
            device_label=data.device_label
        )
        db.add(row)
    db.commit()
    return {"message": "FCM token registered", "user": current_user.name}

@router.delete("/fcm-token")
def remove_fcm_token(
    data: FcmTokenSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Called on logout to stop receiving push notifications on this device."""
    row = db.query(HRFcmToken).filter(
        HRFcmToken.token == data.token,
        HRFcmToken.user_id == current_user.id
    ).first()
    if row:
        db.delete(row)
        db.commit()
    return {"message": "FCM token removed"}

@router.get("/fcm-tokens/me")
def my_fcm_tokens(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Debug: list all registered FCM tokens for the current user."""
    tokens = db.query(HRFcmToken).filter(HRFcmToken.user_id == current_user.id).all()
    return [{"id": t.id, "token_tail": t.token[-10:], "device": t.device_label, "registered": t.created_at} for t in tokens]
