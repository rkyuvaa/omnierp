from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from app.database import get_db
from app.models import User
from app.auth import get_current_user
from app.hr_models import HREmployee, HRShift, HRLeaveBalance, HRLeaveType

router = APIRouter()

# ── Pydantic Schemas ──────────────────────────────────────────────────────────
class EmployeeCreate(BaseModel):
    employee_id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    designation: Optional[str] = None
    department_id: Optional[int] = None
    branch_id: Optional[int] = None
    manager_id: Optional[int] = None
    shift_id: Optional[int] = None
    date_of_joining: Optional[date] = None
    basic_salary: Optional[float] = 0
    salary_components: Optional[List] = []
    biometric_id: Optional[str] = None
    user_id: Optional[int] = None

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    designation: Optional[str] = None
    department_id: Optional[int] = None
    branch_id: Optional[int] = None
    manager_id: Optional[int] = None
    shift_id: Optional[int] = None
    date_of_joining: Optional[date] = None
    date_of_leaving: Optional[date] = None
    basic_salary: Optional[float] = None
    salary_components: Optional[List] = None
    biometric_id: Optional[str] = None
    user_id: Optional[int] = None
    is_active: Optional[bool] = None

# ── Serializer ────────────────────────────────────────────────────────────────
def serialize(e: HREmployee):
    return {
        "id": e.id,
        "employee_id": e.employee_id,
        "user_id": e.user_id,
        "name": e.name,
        "email": e.email,
        "phone": e.phone,
        "designation": e.designation,
        "department_id": e.department_id,
        "department_name": e.department.name if e.department else None,
        "branch_id": e.branch_id,
        "branch_name": e.branch.name if e.branch else None,
        "manager_id": e.manager_id,
        "shift_id": e.shift_id,
        "shift_name": e.shift.name if e.shift else None,
        "date_of_joining": str(e.date_of_joining) if e.date_of_joining else None,
        "date_of_leaving": str(e.date_of_leaving) if e.date_of_leaving else None,
        "basic_salary": float(e.basic_salary or 0),
        "salary_components": e.salary_components or [],
        "biometric_id": e.biometric_id,
        "is_active": e.is_active,
        "created_at": str(e.created_at),
    }

# ── Routes ────────────────────────────────────────────────────────────────────
@router.get("/")
def list_employees(
    branch_id: Optional[int] = None,
    department_id: Optional[int] = None,
    shift_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(HREmployee)
    if branch_id:
        q = q.filter(HREmployee.branch_id == branch_id)
    if department_id:
        q = q.filter(HREmployee.department_id == department_id)
    if shift_id:
        q = q.filter(HREmployee.shift_id == shift_id)
    if is_active is not None:
        q = q.filter(HREmployee.is_active == is_active)
    if search:
        q = q.filter(
            HREmployee.name.ilike(f"%{search}%") |
            HREmployee.employee_id.ilike(f"%{search}%") |
            HREmployee.email.ilike(f"%{search}%")
        )
    return [serialize(e) for e in q.order_by(HREmployee.name).all()]


@router.post("/")
def create_employee(
    data: EmployeeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if db.query(HREmployee).filter(HREmployee.employee_id == data.employee_id).first():
        raise HTTPException(400, "Employee ID already exists")
    emp = HREmployee(**data.model_dump())
    db.add(emp); db.commit(); db.refresh(emp)
    return serialize(emp)


@router.get("/next-id")
def next_employee_id(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    last = db.query(HREmployee).order_by(HREmployee.id.desc()).first()
    if not last:
        return {"next_id": "EMP001"}
    try:
        num = int(last.employee_id.replace("EMP", "")) + 1
        return {"next_id": f"EMP{str(num).zfill(3)}"}
    except:
        return {"next_id": "EMP001"}


@router.get("/{emp_id}")
def get_employee(emp_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    emp = db.query(HREmployee).filter(HREmployee.id == emp_id).first()
    if not emp:
        raise HTTPException(404, "Employee not found")
    result = serialize(emp)
    # Include leave balances for this year
    year = datetime.now().year
    balances = db.query(HRLeaveBalance).filter(
        HRLeaveBalance.employee_id == emp_id,
        HRLeaveBalance.year == year
    ).all()
    result["leave_balances"] = [
        {
            "leave_type_id": b.leave_type_id,
            "leave_type_name": b.leave_type.name if b.leave_type else None,
            "leave_type_code": b.leave_type.code if b.leave_type else None,
            "allocated_days": b.allocated_days,
            "used_days": b.used_days,
            "remaining_days": b.allocated_days - b.used_days,
        }
        for b in balances
    ]
    return result


@router.put("/{emp_id}")
def update_employee(
    emp_id: int,
    data: EmployeeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    emp = db.query(HREmployee).filter(HREmployee.id == emp_id).first()
    if not emp:
        raise HTTPException(404, "Employee not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(emp, k, v)
    db.commit(); db.refresh(emp)
    return serialize(emp)


@router.delete("/{emp_id}")
def deactivate_employee(emp_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    emp = db.query(HREmployee).filter(HREmployee.id == emp_id).first()
    if not emp:
        raise HTTPException(404, "Employee not found")
    emp.is_active = False
    db.commit()
    return {"message": "Employee deactivated"}
