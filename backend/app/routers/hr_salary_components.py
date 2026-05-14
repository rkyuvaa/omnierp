from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models import User
from app.auth import get_current_user
from app.hr_models import HRSalaryComponent

router = APIRouter()

CALC_TYPES = [
    "percentage_of_ctc",
    "percentage_of_basic",
    "percentage_of_gross",
    "fixed",
]

class SalaryComponentCreate(BaseModel):
    name: str
    code: str
    component_type: str = "earning"   # earning | deduction
    calc_type: str = "percentage_of_ctc"
    calc_value: float = 0
    show_on_payslip: bool = True
    sort_order: int = 0

class SalaryComponentUpdate(SalaryComponentCreate):
    is_active: Optional[bool] = True

def _serialize(c: HRSalaryComponent):
    return {
        "id": c.id,
        "name": c.name,
        "code": c.code,
        "component_type": c.component_type,
        "calc_type": c.calc_type,
        "calc_value": c.calc_value,
        "show_on_payslip": c.show_on_payslip,
        "is_active": c.is_active,
        "sort_order": c.sort_order,
    }

@router.get("/")
def list_components(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    comps = db.query(HRSalaryComponent).order_by(HRSalaryComponent.sort_order, HRSalaryComponent.id).all()
    return [_serialize(c) for c in comps]

@router.post("/")
def create_component(data: SalaryComponentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if db.query(HRSalaryComponent).filter(HRSalaryComponent.code == data.code.upper()).first():
        raise HTTPException(400, f"Component code '{data.code}' already exists")
    c = HRSalaryComponent(**data.model_dump())
    c.code = c.code.upper()
    db.add(c); db.commit(); db.refresh(c)
    return _serialize(c)

@router.put("/{comp_id}")
def update_component(comp_id: int, data: SalaryComponentUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    c = db.query(HRSalaryComponent).filter(HRSalaryComponent.id == comp_id).first()
    if not c: raise HTTPException(404, "Not found")
    for k, v in data.model_dump().items():
        setattr(c, k, v)
    c.code = c.code.upper()
    db.commit(); db.refresh(c)
    return _serialize(c)

@router.delete("/{comp_id}")
def delete_component(comp_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    c = db.query(HRSalaryComponent).filter(HRSalaryComponent.id == comp_id).first()
    if not c: raise HTTPException(404, "Not found")
    c.is_active = False
    db.commit()
    return {"message": "Deactivated"}
