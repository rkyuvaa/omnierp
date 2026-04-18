from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..models import Installation, Stage, User
from ..auth import get_current_user, require_admin
from pydantic import BaseModel
import datetime

router = APIRouter()

class InstIn(BaseModel):
    customer_name: Optional[str] = None
    vehicle_number: Optional[str] = None
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None
    stage_id: Optional[int] = None
    technician_id: Optional[int] = None
    notes: Optional[str] = None
    custom_data: dict = {}

def serialize(r):
    try:
        return {
            "id": r.id, 
            "reference": r.reference, 
            "customer_name": r.customer_name or "—",
            "vehicle_number": r.vehicle_number or "—",
            "vehicle_make": r.vehicle_make or "—",
            "vehicle_model": r.vehicle_model or "—",
            "stage_id": r.stage_id,
            "stage_name": r.stage.name if r.stage else None,
            "stage_color": r.stage.color if r.stage else None,
            "technician_id": r.technician_id,
            "technician_name": r.technician.name if r.technician else "Unassigned",
            "created_at": str(r.created_at) if r.created_at else None,
            "custom_data": r.custom_data or {}
        }
    except:
        return {"id": getattr(r, 'id', 0), "reference": "Error"}

@router.get("/")
def get_inst(search: str = "", stage_id: str = "", page: int = 1, db: Session = Depends(get_db)):
    q = db.query(Installation)
    if search:
        q = q.filter(Installation.customer_name.ilike(f"%{search}%") | Installation.reference.ilike(f"%{search}%"))
    if stage_id and stage_id != "":
        q = q.filter(Installation.stage_id == int(stage_id))
    
    total = q.count()
    limit = 50
    skip = (page - 1) * limit
    items = q.order_by(Installation.id.desc()).offset(skip).limit(limit).all()
    return {"items": [serialize(i) for i in items], "total": total, "pages": (total // limit) + 1}

@router.get("/{id}")
def get_one(id: int, db: Session = Depends(get_db)):
    r = db.query(Installation).filter(Installation.id == id).first()
    if not r: raise HTTPException(404, "Not found")
    return serialize(r)

@router.post("/")
def create_inst(data: InstIn, db: Session = Depends(get_db)):
    # Simple reference generation
    count = db.query(Installation).count()
    ref = f"INST/{datetime.datetime.now().year}/{count+1:04d}"
    r = Installation(**data.model_dump(), reference=ref)
    db.add(r); db.commit(); db.refresh(r); return serialize(r)

@router.put("/{id}")
def update_inst(id: int, data: InstIn, db: Session = Depends(get_db)):
    r = db.query(Installation).filter(Installation.id == id).first()
    if not r: raise HTTPException(404, "Not found")
    for k, v in data.model_dump().items(): setattr(r, k, v)
    db.commit(); return serialize(r)
