from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.models import AuditLog
from app.auth import require_admin

router = APIRouter()

@router.get("/")
def list_logs(search: Optional[str] = None, module: Optional[str] = None, record_id: Optional[int] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db), _=Depends(require_admin)):
    q = db.query(AuditLog)
    if search:
        from sqlalchemy import or_
        q = q.filter(or_(
            AuditLog.record_ref.ilike(f"%{search}%"),
            AuditLog.user_name.ilike(f"%{search}%")
        ))
    if module: q = q.filter(AuditLog.module == module)
    if record_id: q = q.filter(AuditLog.record_id == record_id)
    total = q.count()
    items = q.order_by(AuditLog.id.desc()).offset(skip).limit(limit).all()
    return {
        "total": total, 
        "items": [
            {
                "id": i.id, "user_name": i.user_name, "action": i.action, 
                "module": i.module, "record_ref": i.record_ref, 
                "changes": i.changes, "created_at": str(i.created_at)
            } for i in items
        ]
    }
