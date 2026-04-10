from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from app.database import get_db
from app.models import User
from app.auth import get_current_user, require_admin, hash_password, log_action

router = APIRouter()

class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role_id: Optional[int] = None
    branch_id: Optional[int] = None
    allowed_modules: List[str] = []
    is_superadmin: bool = False

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role_id: Optional[int] = None
    branch_id: Optional[int] = None
    allowed_modules: Optional[List[str]] = None
    is_active: Optional[bool] = None
    is_superadmin: Optional[bool] = None

def serialize(u: User):
    return {
        "id": u.id, "name": u.name, "email": u.email,
        "is_active": u.is_active, "is_superadmin": u.is_superadmin,
        "role_id": u.role_id, "branch_id": u.branch_id,
        "allowed_modules": u.allowed_modules or [],
        "role_name": u.role.name if u.role else None,
        "branch_name": u.branch.name if u.branch else None,
        "created_at": str(u.created_at),
    }

@router.get("/")
def list_users(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    users = db.query(User).all()
    return [serialize(u) for u in users]

@router.post("/")
def create_user(data: UserCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(400, "Email already exists")
    user = User(
        name=data.name, email=data.email,
        hashed_password=hash_password(data.password),
        role_id=data.role_id, branch_id=data.branch_id,
        allowed_modules=data.allowed_modules, is_superadmin=data.is_superadmin
    )
    db.add(user); db.commit(); db.refresh(user)
    log_action(db, current_user, "CREATE", "users", user.id, user.email)
    return serialize(user)

@router.get("/{user_id}")
def get_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user: raise HTTPException(404, "Not found")
    return serialize(user)

@router.put("/{user_id}")
def update_user(user_id: int, data: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user: raise HTTPException(404, "Not found")
    for k, v in data.model_dump(exclude_none=True).items():
        if k == "password":
            user.hashed_password = hash_password(v)
        else:
            setattr(user, k, v)
    db.commit(); db.refresh(user)
    log_action(db, current_user, "UPDATE", "users", user.id, user.email)
    return serialize(user)

@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user: raise HTTPException(404, "Not found")
    db.delete(user); db.commit()
    return {"message": "Deleted"}
