from datetime import datetime, timedelta
from jose import JWTError, jwt
import bcrypt as _bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.config import settings


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password[:72].encode(), _bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain[:72].encode(), hashed.encode())

def create_token(data: dict) -> str:
    exp = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({**data, "exp": exp}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    cred_exc = HTTPException(status_code=401, detail="Invalid credentials")
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise cred_exc
    except JWTError:
        raise cred_exc
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.is_active:
        raise cred_exc
    return user

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_superadmin:
        raise HTTPException(status_code=403, detail="Admin required")
    return current_user

def log_action(db: Session, user, action: str, module: str, record_id: int, ref: str = "", changes: dict = {}):
    from app.models import AuditLog
    log = AuditLog(
        user_id=user.id if user else None,
        user_name=user.name if user else "System",
        action=action, module=module, record_id=record_id,
        record_ref=ref, changes=changes
    )
    db.add(log)
    db.commit()

def next_sequence(db: Session, module: str) -> str:
    from app.models import SequenceConfig
    seq = db.query(SequenceConfig).filter(SequenceConfig.module == module).first()
    if not seq:
        seq = SequenceConfig(module=module, prefix=module[:3].upper(), padding=4, current_number=0)
        db.add(seq)
    seq.current_number += 1
    db.commit()
    year = datetime.now().year
    num = str(seq.current_number).zfill(seq.padding)
    prefix = seq.prefix or ""
    suffix = seq.suffix or ""
    if prefix:
        return f"{prefix}/{year}/{num}{suffix}"
    return f"{year}/{num}{suffix}"


def get_current_employee(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.hr_models import HREmployee
    # 1. Try to find by direct user_id link
    emp = db.query(HREmployee).filter(HREmployee.user_id == current_user.id).first()
    
    # 2. Self-healing fallback: Match by email and auto-link user_id
    if not emp and current_user.email:
        emp = db.query(HREmployee).filter(HREmployee.email == current_user.email).first()
        if emp:
            emp.user_id = current_user.id
            db.commit()
            db.refresh(emp)
            
    if not emp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current user is not linked to an Employee record"
        )
    return emp


def get_current_employee_optional(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.hr_models import HREmployee
    emp = db.query(HREmployee).filter(HREmployee.user_id == current_user.id).first()
    
    # Self-healing fallback: Match by email and auto-link user_id
    if not emp and current_user.email:
        emp = db.query(HREmployee).filter(HREmployee.email == current_user.email).first()
        if emp and not emp.user_id:
            emp.user_id = current_user.id
            db.commit()
            db.refresh(emp)
    return emp

