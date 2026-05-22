from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.models import User
from app.auth import get_current_user
from app.hr_models import HRPushSubscription
from app.config import settings

router = APIRouter()

class KeysSchema(BaseModel):
    p256dh: str
    auth: str

class SubscriptionSchema(BaseModel):
    endpoint: str
    keys: KeysSchema

class UnsubscribeSchema(BaseModel):
    endpoint: str

@router.get("/vapid-public-key")
def get_vapid_public_key(current_user: User = Depends(get_current_user)):
    """Return the server's VAPID public key so the frontend can subscribe."""
    return {"public_key": settings.VAPID_PUBLIC_KEY}

@router.post("/subscribe")
def subscribe(
    data: SubscriptionSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Save or update a push subscription for the logged-in user."""
    # Check if subscription already exists
    sub = db.query(HRPushSubscription).filter(HRPushSubscription.endpoint == data.endpoint).first()
    
    if sub:
        # Update details if they belong to the same user or transfer to new user
        sub.user_id = current_user.id
        sub.p256dh = data.keys.p256dh
        sub.auth = data.keys.auth
    else:
        # Create new subscription
        sub = HRPushSubscription(
            user_id=current_user.id,
            endpoint=data.endpoint,
            p256dh=data.keys.p256dh,
            auth=data.keys.auth
        )
        db.add(sub)
    
    db.commit()
    return {"message": "Subscribed successfully"}

@router.post("/unsubscribe")
def unsubscribe(
    data: UnsubscribeSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove a push subscription when the user disables notifications or logs out."""
    sub = db.query(HRPushSubscription).filter(
        HRPushSubscription.endpoint == data.endpoint,
        HRPushSubscription.user_id == current_user.id
    ).first()
    
    if sub:
        db.delete(sub)
        db.commit()
        return {"message": "Unsubscribed successfully"}
    
    return {"message": "Subscription not found"}
