from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.models import User, Role, Branch, Module
from app.auth import verify_password, create_token, hash_password, get_current_user

router = APIRouter()

class UserOut(BaseModel):
    id: int
    name: str
    email: str
    is_superadmin: bool
    allowed_modules: list
    role_id: int | None
    branch_id: int | None
    class Config: from_attributes = True

@router.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}

@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "is_superadmin": current_user.is_superadmin,
        "allowed_modules": current_user.allowed_modules or [],
        "role_id": current_user.role_id,
        "branch_id": current_user.branch_id,
    }

@router.post("/setup")
def initial_setup(db: Session = Depends(get_db)):
    if db.query(User).count() > 0:
        raise HTTPException(status_code=400, detail="Already setup")
    # Create default role
    admin_role = Role(name="Administrator", permissions={"all": True})
    db.add(admin_role)
    # Create default branch
    hq = Branch(name="Head Office")
    db.add(hq)
    db.flush()
    # Create admin user
    admin = User(
        name="Admin", email="admin@erp.com",
        hashed_password=hash_password("admin123"),
        is_superadmin=True, role_id=admin_role.id, branch_id=hq.id,
        allowed_modules=["crm", "installation", "service", "studio"]
    )
    db.add(admin)
    # Create default modules
    mods = [
        Module(key="crm", name="CRM", icon="users"),
        Module(key="installation", name="Installation", icon="wrench"),
        Module(key="service", name="Service", icon="tool"),
        Module(key="studio", name="Studio", icon="layout"),
    ]
    for m in mods:
        db.add(m)
    # Default stages for CRM
    from app.models import Stage, SequenceConfig
    crm_stages = [
        Stage(module="crm", name="New", color="#6366f1", sort_order=1),
        Stage(module="crm", name="Qualified", color="#f59e0b", sort_order=2),
        Stage(module="crm", name="Won", color="#10b981", sort_order=3, is_final_win=True),
        Stage(module="crm", name="Lost", color="#ef4444", sort_order=4, is_final_lost=True),
    ]
    inst_stages = [
        Stage(module="installation", name="Pending", color="#f59e0b", sort_order=1),
        Stage(module="installation", name="In Progress", color="#6366f1", sort_order=2),
        Stage(module="installation", name="Completed", color="#10b981", sort_order=3, is_final_win=True),
    ]
    svc_stages = [
        Stage(module="service", name="Open", color="#6366f1", sort_order=1),
        Stage(module="service", name="In Service", color="#f59e0b", sort_order=2),
        Stage(module="service", name="Completed", color="#10b981", sort_order=3, is_final_win=True),
    ]
    for s in crm_stages + inst_stages + svc_stages:
        db.add(s)
    # Sequence configs
    for mod, prefix in [("crm","LEAD"), ("installation","INST"), ("service","SVC")]:
        db.add(SequenceConfig(module=mod, prefix=prefix, padding=4, current_number=0))
    db.commit()
    return {"message": "Setup complete", "email": "admin@erp.com", "password": "admin123"}
