from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Module
from app.auth import require_admin

router = APIRouter()

@router.get("/")
def list_modules(db: Session = Depends(get_db)):
    return db.query(Module).all()

@router.put("/{mid}/toggle")
def toggle_module(mid: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    m = db.query(Module).filter(Module.id == mid).first()
    if not m: raise HTTPException(404, "Not found")
    m.is_active = not m.is_active
    db.commit(); db.refresh(m); return m


def seed_modules(db: Session):
    """Seed default system modules if they don't exist in the database."""
    defaults = [
        {"key": "crm", "name": "CRM", "icon": "users"},
        {"key": "installation", "name": "KIM Installation", "icon": "wrench"},
        {"key": "service", "name": "Service", "icon": "clipboard-list"},
        {"key": "warranty", "name": "Product & Warranty", "icon": "shield-check"},
        {"key": "konwertcare", "name": "Konwert Care+", "icon": "heart-pulse"},
        {"key": "tasks", "name": "Task Management", "icon": "check-square-2"},
        {"key": "studio", "name": "Studio", "icon": "settings"}
    ]
    for idx, item in enumerate(defaults):
        exists = db.query(Module).filter(Module.key == item["key"]).first()
        if not exists:
            m = Module(
                key=item["key"],
                name=item["name"],
                icon=item["icon"],
                is_active=True,
                sort_order=idx
            )
            db.add(m)
        else:
            # Sync name and icon if they changed
            exists.name = item["name"]
            exists.icon = item["icon"]
            exists.sort_order = idx
    db.commit()
