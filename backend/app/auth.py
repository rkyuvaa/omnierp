from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

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
    prefix = seq.prefix
    suffix = seq.suffix
    if prefix:
        return f"{prefix}/{year}/{num}{suffix}"
    return f"{year}/{num}{suffix}"
