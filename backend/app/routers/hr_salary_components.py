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
    "slab",
]

class SalaryComponentCreate(BaseModel):
    name: str
    code: str
    component_type: str = "earning"   # earning | deduction
    calc_type: str = "percentage_of_ctc"
    calc_value: float = 0
    cap_amount: Optional[float] = None  # e.g. 15000 for PF cap
    slabs: Optional[list] = None  # [{"min":0,"max":10000,"value":0}, ...]
    apply_if_gross_below: Optional[float] = None  # ESI: only if gross ≤ 21000
    apply_if_gross_above: Optional[float] = None  # TDS: only if gross ≥ 100000
    deduct_from: Optional[str] = "gross"  # gross | basic
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
        "cap_amount": c.cap_amount,
        "slabs": c.slabs or [],
        "apply_if_gross_below": getattr(c, 'apply_if_gross_below', None),
        "apply_if_gross_above": getattr(c, 'apply_if_gross_above', None),
        "deduct_from": getattr(c, 'deduct_from', 'gross'),
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
    
    old_deduct_from = getattr(c, "deduct_from", "gross")
    for k, v in data.model_dump().items():
        setattr(c, k, v)
    c.code = c.code.upper()
    db.commit()
    db.refresh(c)
    
    # Propagate deduct_from changes to templates and employees dynamically
    if old_deduct_from != c.deduct_from:
        from app.hr_models import HRSalaryTemplate, HREmployee
        # 1. Update templates
        templates = db.query(HRSalaryTemplate).all()
        for t in templates:
            if t.components:
                comps = list(t.components)
                updated = False
                for item in comps:
                    if item.get("component_id") == c.id or item.get("code") == c.code:
                        if item.get("deduct_from") != c.deduct_from:
                            item["deduct_from"] = c.deduct_from
                            updated = True
                if updated:
                    t.components = comps
                    db.add(t)
                    
        # 2. Update employee records
        employees = db.query(HREmployee).all()
        for emp in employees:
            if emp.salary_components:
                comps = list(emp.salary_components)
                updated = False
                for item in comps:
                    if item.get("component_id") == c.id or item.get("code") == c.code or item.get("name") == c.name:
                        if item.get("deduct_from") != c.deduct_from:
                            item["deduct_from"] = c.deduct_from
                            updated = True
                if updated:
                    emp.salary_components = comps
                    db.add(emp)
                    
        db.commit()
        
    return _serialize(c)

@router.delete("/{comp_id}")
def delete_component(comp_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    c = db.query(HRSalaryComponent).filter(HRSalaryComponent.id == comp_id).first()
    if not c: raise HTTPException(404, "Not found")
    c.is_active = False
    db.commit()
    return {"message": "Deactivated"}
