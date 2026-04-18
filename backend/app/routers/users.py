from sqlalchemy import or_
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Any, Optional, List
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
    department_id: Optional[int] = None
    allowed_branches: List[int] = []
    allowed_modules: Any = {}
    is_superadmin: bool = False

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role_id: Optional[int] = None
    branch_id: Optional[int] = None
    department_id: Optional[int] = None
    allowed_branches: List[int] = []
    allowed_modules: Optional[Any] = {}
    is_active: Optional[bool] = None
    is_superadmin: Optional[bool] = None

def serialize(u: User):
    return {
        "id": u.id, "name": u.name, "email": u.email,
        "is_active": u.is_active, "is_superadmin": u.is_superadmin,
        "role_id": u.role_id, "branch_id": u.branch_id, "department_id": u.department_id,
        "allowed_branches": u.allowed_branches or [],
        "allowed_modules": u.allowed_modules or [],
        "role_name": u.role.name if u.role else None,
        "branch_name": u.branch.name if u.branch else None,
        "department_name": getattr(u.department, 'name', None) if hasattr(u, 'department') else None,
        "created_at": str(u.created_at),
    }

@router.get("/")
def list_users(branch_id: Optional[int] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(User)
    if branch_id:
        # Filter users who have this branch_id primary OR in their allowed_branches JSON list
        from sqlalchemy import cast, JSON
        query = query.filter(or_(
            User.branch_id == branch_id,
            User.allowed_branches.contains([branch_id])
        ))
    users = query.all()
    return [serialize(u) for u in users]

@router.post("/")
def create_user(data: UserCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(400, "Email already exists")
    user = User(
        name=data.name, email=data.email,
        password_hash=hash_password(data.password),
        role_id=data.role_id, branch_id=data.branch_id, department_id=data.department_id,
        allowed_branches=data.allowed_branches,
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
            user.password_hash = hash_password(v)
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
