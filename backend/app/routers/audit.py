from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.models import AuditLog
from app.auth import require_admin

router = APIRouter()

@router.get("/")
def list_logs(module: Optional[str] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db), _=Depends(require_admin)):
    q = db.query(AuditLog)
    if module: q = q.filter(AuditLog.module == module)
    total = q.count()
    items = q.order_by(AuditLog.id.desc()).offset(skip).limit(limit).all()
    return {"total": total, "items": [{"id": i.id, "user_name": i.user_name, "action": i.action, "module": i.module, "record_ref": i.record_ref, "created_at": str(i.created_at)} for i in items]}
