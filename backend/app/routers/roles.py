from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models import Role
from app.auth import require_admin

router = APIRouter()

class RoleIn(BaseModel):
    name: str
    permissions: dict = {}

@router.get("/")
def list_roles(db: Session = Depends(get_db)):
    return db.query(Role).all()

@router.post("/")
def create_role(data: RoleIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    r = Role(**data.model_dump()); db.add(r); db.commit(); db.refresh(r); return r

@router.put("/{rid}")
def update_role(rid: int, data: RoleIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    r = db.query(Role).filter(Role.id == rid).first()
    if not r: raise HTTPException(404, "Not found")
    for k, v in data.model_dump().items(): setattr(r, k, v)
    db.commit(); db.refresh(r); return r

@router.delete("/{rid}")
def delete_role(rid: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    r = db.query(Role).filter(Role.id == rid).first()
    if not r: raise HTTPException(404, "Not found")
    db.delete(r); db.commit(); return {"message": "Deleted"}
