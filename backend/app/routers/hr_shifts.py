from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from app.database import get_db
from app.models import User
from app.auth import get_current_user
from app.hr_models import HRShift

router = APIRouter()

class ShiftCreate(BaseModel):
    name: str
    branch_id: Optional[int] = None
    start_time: str   # "09:00"
    end_time: str     # "18:00"
    grace_minutes: int = 15
    half_day_hours: float = 4.0
    working_days: List[str] = ["Mon","Tue","Wed","Thu","Fri","Sat"]

class ShiftUpdate(BaseModel):
    name: Optional[str] = None
    branch_id: Optional[int] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    grace_minutes: Optional[int] = None
    half_day_hours: Optional[float] = None
    working_days: Optional[List[str]] = None
    is_active: Optional[bool] = None

def serialize(s: HRShift):
    return {
        "id": s.id,
        "name": s.name,
        "branch_id": s.branch_id,
        "branch_name": s.branch.name if s.branch else None,
        "start_time": s.start_time,
        "end_time": s.end_time,
        "grace_minutes": s.grace_minutes,
        "half_day_hours": s.half_day_hours,
        "working_days": s.working_days or [],
        "is_active": s.is_active,
        "created_at": str(s.created_at),
    }

@router.get("/")
def list_shifts(branch_id: Optional[int] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(HRShift)
    if branch_id:
        q = q.filter(HRShift.branch_id == branch_id)
    return [serialize(s) for s in q.all()]

@router.post("/")
def create_shift(data: ShiftCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    shift = HRShift(**data.model_dump())
    db.add(shift); db.commit(); db.refresh(shift)
    return serialize(shift)

@router.put("/{shift_id}")
def update_shift(shift_id: int, data: ShiftUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    shift = db.query(HRShift).filter(HRShift.id == shift_id).first()
    if not shift: raise HTTPException(404, "Shift not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(shift, k, v)
    db.commit(); db.refresh(shift)
    return serialize(shift)

@router.delete("/{shift_id}")
def delete_shift(shift_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    shift = db.query(HRShift).filter(HRShift.id == shift_id).first()
    if not shift: raise HTTPException(404, "Shift not found")
    shift.is_active = False
    db.commit()
    return {"message": "Shift deactivated"}
