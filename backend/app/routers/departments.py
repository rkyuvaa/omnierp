from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from app.database import get_db
from app.models import Department
from app.auth import require_admin

router = APIRouter()

class DepartmentIn(BaseModel):
    name: str
    is_active: bool = True

@router.get("/")
def list_departments(db: Session = Depends(get_db)):
    return db.query(Department).all()

@router.post("/")
def create_department(data: DepartmentIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    d = Department(**data.model_dump()); db.add(d); db.commit(); db.refresh(d)
    return d

@router.put("/{did}")
def update_department(did: int, data: DepartmentIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    d = db.query(Department).filter(Department.id == did).first()
    if not d: raise HTTPException(404, "Not found")
    for k, v in data.model_dump().items(): setattr(d, k, v)
    db.commit(); db.refresh(d); return d

@router.delete("/{did}")
def delete_department(did: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    d = db.query(Department).filter(Department.id == did).first()
    if not d: raise HTTPException(404, "Not found")
    db.delete(d); db.commit(); return {"message": "Deleted"}
