from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import date
from app.database import get_db
from app.models import User
from app.auth import get_current_user
from app.hr_models import HRHoliday

router = APIRouter()

class HolidayCreate(BaseModel):
    name: str
    date: date
    branch_id: Optional[int] = None
    holiday_type: str = "national"  # national / company

class HolidayUpdate(BaseModel):
    name: Optional[str] = None
    date: Optional[date] = None
    branch_id: Optional[int] = None
    holiday_type: Optional[str] = None
    is_active: Optional[bool] = None

def serialize(h: HRHoliday):
    return {
        "id": h.id,
        "name": h.name,
        "date": str(h.date),
        "branch_id": h.branch_id,
        "branch_name": h.branch.name if h.branch else "All Branches",
        "holiday_type": h.holiday_type,
        "is_active": h.is_active,
    }

@router.get("/")
def list_holidays(
    branch_id: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from sqlalchemy import extract
    q = db.query(HRHoliday).filter(HRHoliday.is_active == True)
    if branch_id:
        q = q.filter((HRHoliday.branch_id == branch_id) | (HRHoliday.branch_id == None))
    if year:
        q = q.filter(extract('year', HRHoliday.date) == year)
    return [serialize(h) for h in q.order_by(HRHoliday.date).all()]

@router.post("/")
def create_holiday(data: HolidayCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    holiday = HRHoliday(**data.model_dump())
    db.add(holiday); db.commit(); db.refresh(holiday)
    return serialize(holiday)

@router.put("/{holiday_id}")
def update_holiday(holiday_id: int, data: HolidayUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    holiday = db.query(HRHoliday).filter(HRHoliday.id == holiday_id).first()
    if not holiday: raise HTTPException(404, "Holiday not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(holiday, k, v)
    db.commit(); db.refresh(holiday)
    return serialize(holiday)

@router.delete("/{holiday_id}")
def delete_holiday(holiday_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    holiday = db.query(HRHoliday).filter(HRHoliday.id == holiday_id).first()
    if not holiday: raise HTTPException(404, "Holiday not found")
    db.delete(holiday); db.commit()
    return {"message": "Deleted"}
