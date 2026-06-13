from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.models import User
from app.auth import get_current_user

router = APIRouter()

class RegisterTokenSchema(BaseModel):
    token: str

@router.post("/register-token")
def register_token(
    data: RegisterTokenSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Saves the FCM token to the logged-in user's record.
    Clears the token from other users to avoid duplicates.
    """
    if not data.token or len(data.token) < 20:
        raise HTTPException(status_code=400, detail="Invalid FCM token")

    try:
        # Clear token from other users if it was previously registered to them
        db.query(User).filter(User.fcm_token == data.token, User.id != current_user.id).update({"fcm_token": None})
        
        # Save to current user
        current_user.fcm_token = data.token
        db.commit()
        return {"message": "FCM token registered successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error registering token: {str(e)}")
