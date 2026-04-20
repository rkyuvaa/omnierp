from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..models import Installation, Stage, User
from ..auth import get_current_user, require_admin
from pydantic import BaseModel
import datetime

from sqlalchemy import func
router = APIRouter()

@router.get("/summary")
def get_summary(db: Session = Depends(get_db)):
    results = db.query(Installation.stage_id, func.count(Installation.id)).group_by(Installation.stage_id).all()
    counts = {r[0]: r[1] for r in results}
    # Also fetch stage metadata
    stages = db.query(Stage).filter(Stage.module == "installation").order_by(Stage.sort_order).all()
    return [{
        "id": s.id, 
        "name": s.name, 
        "color": s.color, 
        "count": counts.get(s.id, 0)
    } for s in stages]

class InstIn(BaseModel):
    customer_name: Optional[str] = None
    vehicle_number: Optional[str] = None
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None
    stage_id: Optional[int] = None
    technician_id: Optional[int] = None
    product_id: Optional[int] = None
    schedule_date: Optional[str] = None
    notes: Optional[str] = None
    custom_data: dict = {}

def serialize(r):
    try:
        return {
            "id": r.id,
            "reference": r.reference,
            "customer_name": r.customer_name or "Unknown",
            "vehicle_number": r.vehicle_number or (r.product.name if getattr(r, 'product', None) else "—"),
            "vehicle_make": r.vehicle_make or "—",
            "vehicle_model": r.vehicle_model or "—",
            "stage_id": r.stage_id,
            "stage_name": r.stage.name if getattr(r, 'stage', None) else "Unassigned",
            "stage_color": r.stage.color if getattr(r, 'stage', None) else "#94a3b8",
            "technician_id": r.technician_id,
            "technician_name": r.technician.name if getattr(r, 'technician', None) else "Unassigned",
            "product_id": r.product_id,
            "schedule_date": str(r.schedule_date) if r.schedule_date else None,
            "created_at": str(r.created_at) if r.created_at else None,
            "custom_data": r.custom_data or {}
        }
    except Exception as e:
        return {"id": r.id, "reference": r.reference, "error": str(e)}

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
    try:
        # Guaranteed unique reference generation
        last = db.query(Installation).order_by(Installation.id.desc()).first()
        next_id = (last.id + 1) if last else 1
        year = datetime.datetime.now().year
        ref = f"INST/{year}/{next_id:04d}"
        
        # Check for collision and skip
        while db.query(Installation).filter(Installation.reference == ref).first():
            next_id += 1
            ref = f"INST/{year}/{next_id:04d}"
            
        r_data = data.model_dump()
        
        # Mandatory field fallbacks
        if not r_data.get('customer_name'):
            r_data['customer_name'] = "New Customer"
        
        # Robust date parsing
        sd = r_data.get('schedule_date')
        if sd and str(sd).strip():
            try: r_data['schedule_date'] = datetime.datetime.strptime(str(sd), '%Y-%m-%d').date()
            except: r_data['schedule_date'] = None
        else:
            r_data['schedule_date'] = None

        r = Installation(**r_data, reference=ref)
        db.add(r); db.commit(); db.refresh(r); return serialize(r)
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Database Error: {str(e)}")

@router.put("/{id}")
def update_inst(id: int, data: InstIn, db: Session = Depends(get_db)):
    try:
        r = db.query(Installation).filter(Installation.id == id).first()
        if not r: raise HTTPException(404, "Not found")
        
        r_data = data.model_dump()
        
        # Robust date parsing
        sd = r_data.get('schedule_date')
        if sd and str(sd).strip():
            try: r_data['schedule_date'] = datetime.datetime.strptime(str(sd), '%Y-%m-%d').date()
            except: r_data['schedule_date'] = None
        else:
            r_data['schedule_date'] = None

        for k, v in r_data.items(): setattr(r, k, v)
        db.commit(); return serialize(r)
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Database Error: {str(e)}")
