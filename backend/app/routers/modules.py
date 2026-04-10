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
