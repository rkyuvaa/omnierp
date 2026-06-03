import pyotp
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.models import User, Role, Branch, Module
from app.auth import verify_password, create_token, hash_password, get_current_user, log_action

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

class VerifyTOTPRequest(BaseModel):
    mfa_token: str
    code: str

class VerifySetupTOTPRequest(BaseModel):
    secret: str
    code: str

class DisableTOTPRequest(BaseModel):
    code: Optional[str] = None
    password: Optional[str] = None

@router.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    from datetime import datetime, timedelta
    if user.totp_enabled:
        # Create a short-lived MFA token (5 minutes)
        mfa_token = create_token(
            {"sub": str(user.id), "mfa_pending": True},
            expires_delta=timedelta(minutes=5)
        )
        return {"mfa_required": True, "mfa_token": mfa_token}

    user.last_login = datetime.utcnow()
    db.commit()

    token = create_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}

@router.post("/verify-totp")
def verify_totp(data: VerifyTOTPRequest, db: Session = Depends(get_db)):
    from jose import jwt, JWTError
    from app.config import settings
    try:
        payload = jwt.decode(data.mfa_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if not payload.get("mfa_pending"):
            raise HTTPException(status_code=401, detail="Invalid MFA token")
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired MFA token")
        
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.is_active or not user.totp_enabled or not user.totp_secret:
        raise HTTPException(status_code=401, detail="MFA not enabled or user inactive")
        
    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(data.code):
        raise HTTPException(status_code=400, detail="Invalid 6-digit authentication code")
        
    from datetime import datetime
    user.last_login = datetime.utcnow()
    db.commit()
    
    access_token = create_token({"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/setup-totp/initiate")
def setup_totp_initiate(current_user: User = Depends(get_current_user)):
    if current_user.totp_enabled:
        raise HTTPException(status_code=400, detail="MFA is already enabled")
        
    secret = pyotp.random_base32()
    provisioning_uri = pyotp.totp.TOTP(secret).provisioning_uri(
        name=current_user.email,
        issuer_name="OmniERP"
    )
    import urllib.parse
    qr_url = f"https://api.qrserver.com/v1/create-qr-code/?size=200x200&data={urllib.parse.quote(provisioning_uri)}"
    
    return {
        "secret": secret,
        "qr_code_url": qr_url
    }

@router.post("/setup-totp/verify")
def setup_totp_verify(data: VerifySetupTOTPRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.totp_enabled:
        raise HTTPException(status_code=400, detail="MFA is already enabled")
        
    totp = pyotp.TOTP(data.secret)
    if not totp.verify(data.code):
        raise HTTPException(status_code=400, detail="Invalid code. Please try again.")
        
    current_user.totp_secret = data.secret
    current_user.totp_enabled = True
    db.commit()
    
    return {"message": "MFA enabled successfully"}

@router.post("/setup-totp/disable")
def setup_totp_disable(data: DisableTOTPRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.totp_enabled:
        raise HTTPException(status_code=400, detail="Two-Factor Authentication is not enabled")
        
    verified = False
    if data.code:
        totp = pyotp.TOTP(current_user.totp_secret)
        if totp.verify(data.code):
            verified = True
        else:
            raise HTTPException(status_code=400, detail="Invalid verification code")
    elif data.password:
        if verify_password(data.password, current_user.password_hash):
            verified = True
        else:
            raise HTTPException(status_code=400, detail="Invalid password")
    else:
        raise HTTPException(status_code=400, detail="Verification code or password is required")
        
    if verified:
        current_user.totp_secret = None
        current_user.totp_enabled = False
        db.commit()
        log_action(
            db, 
            current_user, 
            "DISABLE_MFA", 
            "users", 
            current_user.id, 
            current_user.email, 
            changes={"totp_enabled": {"old": True, "new": False}}
        )
        return {"message": "Two-Factor Authentication disabled and deleted successfully"}

@router.get("/me")
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.auth import get_current_employee_optional
    emp = get_current_employee_optional(current_user, db)
    is_manager = False
    if emp:
        from app.hr_models import HREmployee
        is_manager = db.query(HREmployee).filter(HREmployee.manager_id == emp.id).first() is not None
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "is_superadmin": current_user.is_superadmin,
        "allowed_modules": current_user.allowed_modules or [],
        "role_id": current_user.role_id,
        "branch_id": current_user.branch_id,
        "department_id": current_user.department_id,
        "allowed_branches": current_user.allowed_branches or [],
        "employee_id": emp.id if emp else None,
        "employee_code": emp.employee_id if emp else None,
        "is_manager": is_manager,
        "enable_mobile_punch": emp.enable_mobile_punch if emp else False,
        "totp_enabled": current_user.totp_enabled or False
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
        password_hash=hash_password("admin123"),
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
