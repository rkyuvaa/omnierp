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
    reset_totp: Optional[bool] = None

def serialize(u: User):
    from datetime import datetime
    return {
        "id": u.id, "name": u.name, "email": u.email,
        "is_active": u.is_active, "is_superadmin": u.is_superadmin,
        "role_id": u.role_id, "branch_id": u.branch_id, "department_id": u.department_id,
        "allowed_branches": u.allowed_branches or [],
        "allowed_modules": u.allowed_modules or [],
        "role_name": u.role.name if u.role else None,
        "branch_name": u.branch.name if u.branch else None,
        "department_name": getattr(u.department, 'name', None) if hasattr(u, 'department') else None,
        "created_at": u.created_at.isoformat() + 'Z' if u.created_at else None,
        "last_login": u.last_login.isoformat() + 'Z' if u.last_login else None,
        "last_active_at": u.last_active_at.isoformat() + 'Z' if u.last_active_at else None,
        "is_online": u.last_active_at is not None and (datetime.utcnow() - u.last_active_at).total_seconds() < 300,
        "totp_enabled": u.totp_enabled or False,
    }

@router.get("/")
def list_users(branch_id: Optional[int] = None, for_tasks: bool = False, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(User)
    if branch_id:
        # Filter users who have this branch_id primary OR in their allowed_branches JSON list
        from sqlalchemy import cast, JSON
        query = query.filter(or_(
            User.branch_id == branch_id,
            User.allowed_branches.contains([branch_id])
        ))
        
    if for_tasks and not current_user.is_superadmin:
        from app.models import Role
        allowed_mods = current_user.allowed_modules or {}
        task_role_id = allowed_mods.get("tasks") or current_user.role_id
        role = db.query(Role).filter(Role.id == task_role_id).first()
        if role:
            role_name = (role.name or "").lower()
            if "general manager" not in role_name:
                perms = role.permissions or {}
                if perms.get("view_team_records_only"):
                    from app.hr_models import HREmployee
                    my_emp = db.query(HREmployee).filter(HREmployee.user_id == current_user.id).first()
                    # Self-healing fallback for current user
                    if not my_emp and current_user.email:
                        my_emp = db.query(HREmployee).filter(HREmployee.email.ilike(current_user.email)).first()
                        if my_emp:
                            my_emp.user_id = current_user.id
                            db.commit()
                            db.refresh(my_emp)

                    allowed_user_ids = [current_user.id]
                    if my_emp:
                        subs = db.query(HREmployee).filter(
                            or_(
                                HREmployee.manager_id == my_emp.id,
                                HREmployee.manager_l2_id == my_emp.id
                            )
                        ).all()
                        
                        sub_emails = [sub.email for sub in subs if sub.email]
                        linked_user_ids = []
                        for sub in subs:
                            if sub.user_id:
                                linked_user_ids.append(sub.user_id)
                        
                        if sub_emails:
                            sub_emails_lower = [email.lower() for email in sub_emails]
                            from sqlalchemy import func
                            matching_users = db.query(User).filter(func.lower(User.email).in_(sub_emails_lower)).all()
                            for mu in matching_users:
                                # Auto-heal the link in the DB
                                for sub in subs:
                                    if sub.email and sub.email.lower() == mu.email.lower() and not sub.user_id:
                                        sub.user_id = mu.id
                                        db.commit()
                                if mu.id not in linked_user_ids:
                                    linked_user_ids.append(mu.id)
                        
                        allowed_user_ids.extend(linked_user_ids)
                    query = query.filter(User.id.in_(allowed_user_ids))
                elif perms.get("view_own_records_only"):
                    query = query.filter(User.id == current_user.id)
    users = query.order_by(User.name.asc()).all()
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
    
    changes = {}
    new_data = data.model_dump(exclude_none=True)
    
    # Handle reset_totp if provided
    if "reset_totp" in new_data:
        if new_data["reset_totp"]:
            user.totp_secret = None
            user.totp_enabled = False
            changes["totp_enabled"] = {"old": True, "new": False}
        del new_data["reset_totp"]

    # Track rights changes specifically
    rights_keys = ["role_id", "branch_id", "allowed_branches", "allowed_modules", "is_superadmin", "is_active"]
    for k in rights_keys:
        if k in new_data:
            old_val = getattr(user, k)
            new_val = new_data[k]
            if old_val != new_val:
                changes[k] = {"old": old_val, "new": new_val}

    for k, v in new_data.items():
        if k == "password":
            user.password_hash = hash_password(v)
            changes["password"] = "Updated"
        else:
            setattr(user, k, v)
            
    db.commit(); db.refresh(user)
    if changes:
        log_action(db, current_user, "UPDATE", "users", user.id, user.email, changes=changes)
    return serialize(user)

@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user: raise HTTPException(404, "Not found")
    db.delete(user); db.commit()
    return {"message": "Deleted"}
