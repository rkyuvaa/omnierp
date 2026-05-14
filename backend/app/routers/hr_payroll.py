from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from calendar import monthrange
from app.database import get_db
from app.models import User
from app.auth import get_current_user
from app.hr_models import HRPayrollRecord, HREmployee, HRAttendanceRecord, HRLeaveBalance, HRLeaveType
from sqlalchemy import extract

router = APIRouter()

class PayrollGenerate(BaseModel):
    employee_ids: list
    month: int
    year: int

class PayrollFinalize(BaseModel):
    month: int
    year: int
    branch_id: Optional[int] = None

def _calculate_payroll(db: Session, emp: HREmployee, month: int, year: int) -> dict:
    """Calculate salary for one employee for a given month"""
    basic = float(emp.basic_salary or 0)
    components = emp.salary_components or []

    # Get attendance summary for the month
    records = db.query(HRAttendanceRecord).filter(
        HRAttendanceRecord.employee_id == emp.id,
        extract('month', HRAttendanceRecord.date) == month,
        extract('year', HRAttendanceRecord.date) == year,
    ).all()

    # Count days
    from calendar import monthrange
    days_in_month = monthrange(year, month)[1]

    working_days = len([r for r in records if r.status not in ["holiday", "weekly_off"]])
    present_days = len([r for r in records if r.status in ["present", "late"]])
    half_days = len([r for r in records if r.status == "half_day"])
    leave_days = len([r for r in records if r.status == "leave"])
    on_duty_days = len([r for r in records if r.status == "on_duty"])
    absent_days = len([r for r in records if r.status == "absent"])

    # Check LOP leave balance usage
    lop_type = db.query(HRLeaveType).filter(HRLeaveType.code == "LOP").first()
    lop_days = 0
    if lop_type:
        balance = db.query(HRLeaveBalance).filter(
            HRLeaveBalance.employee_id == emp.id,
            HRLeaveBalance.leave_type_id == lop_type.id,
            HRLeaveBalance.year == year,
        ).first()
        if balance:
            lop_days = balance.used_days

    # Effective working days = present + late + half(×0.5) + on_duty
    effective = present_days + on_duty_days + (half_days * 0.5) + leave_days
    total_payable_days = working_days if working_days > 0 else 1
    daily_rate = basic / total_payable_days
    payable_basic = round(daily_rate * effective, 2)

    # LOP deduction
    lop_deduction = round(daily_rate * lop_days, 2)

    # Build component breakdown
    earnings = {"Basic Salary": payable_basic}
    deductions = {}

    for comp in components:
        val = comp.get("value", 0)
        ctype = comp.get("type", "earning")
        name = comp.get("name", "Component")
        if comp.get("is_percentage"):
            amount = round(payable_basic * val / 100, 2)
        else:
            amount = round(float(val), 2)
        if ctype == "earning":
            earnings[name] = amount
        else:
            deductions[name] = amount

    if lop_deduction > 0:
        deductions["Loss of Pay"] = lop_deduction

    total_earnings = round(sum(earnings.values()), 2)
    total_deductions = round(sum(deductions.values()), 2)
    net_salary = round(total_earnings - total_deductions, 2)

    return {
        "working_days": working_days,
        "present_days": present_days + (half_days * 0.5),
        "absent_days": absent_days,
        "leave_days": leave_days,
        "lop_days": lop_days,
        "on_duty_days": on_duty_days,
        "basic_salary": payable_basic,
        "total_earnings": total_earnings,
        "total_deductions": total_deductions,
        "net_salary": net_salary,
        "components_breakdown": {"earnings": earnings, "deductions": deductions},
    }

@router.post("/generate")
def generate_payroll(data: PayrollGenerate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    results = []
    for emp_id in data.employee_ids:
        emp = db.query(HREmployee).filter(HREmployee.id == emp_id).first()
        if not emp: continue

        calc = _calculate_payroll(db, emp, data.month, data.year)

        existing = db.query(HRPayrollRecord).filter(
            HRPayrollRecord.employee_id == emp_id,
            HRPayrollRecord.month == data.month,
            HRPayrollRecord.year == data.year,
        ).first()

        if existing and existing.status == "finalized":
            results.append({"employee_id": emp_id, "status": "skipped", "reason": "Already finalized"})
            continue

        if existing:
            for k, v in calc.items():
                setattr(existing, k, v)
            existing.updated_at = datetime.utcnow()
        else:
            record = HRPayrollRecord(
                employee_id=emp_id,
                year=data.year,
                month=data.month,
                **calc
            )
            db.add(record)
        results.append({"employee_id": emp_id, "name": emp.name, "net_salary": calc["net_salary"], "status": "computed"})

    db.commit()
    return results

@router.get("/")
def list_payroll(
    month: int, year: int,
    branch_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(HRPayrollRecord).filter(
        HRPayrollRecord.month == month,
        HRPayrollRecord.year == year,
    )
    records = q.all()
    return [{
        "id": r.id,
        "employee_id": r.employee_id,
        "employee_code": r.employee.employee_id if r.employee else None,
        "employee_name": r.employee.name if r.employee else None,
        "designation": r.employee.designation if r.employee else None,
        "month": r.month, "year": r.year,
        "working_days": r.working_days,
        "present_days": float(r.present_days or 0),
        "absent_days": float(r.absent_days or 0),
        "leave_days": float(r.leave_days or 0),
        "lop_days": float(r.lop_days or 0),
        "on_duty_days": float(r.on_duty_days or 0),
        "basic_salary": float(r.basic_salary or 0),
        "total_earnings": float(r.total_earnings or 0),
        "total_deductions": float(r.total_deductions or 0),
        "net_salary": float(r.net_salary or 0),
        "components_breakdown": r.components_breakdown,
        "status": r.status,
    } for r in records]

@router.post("/{record_id}/finalize")
def finalize_payroll(record_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    record = db.query(HRPayrollRecord).filter(HRPayrollRecord.id == record_id).first()
    if not record: raise HTTPException(404, "Payroll record not found")
    record.status = "finalized"
    record.finalized_at = datetime.utcnow()
    db.commit()
    return {"message": "Payroll finalized"}

@router.get("/{record_id}")
def get_payroll_detail(record_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    record = db.query(HRPayrollRecord).filter(HRPayrollRecord.id == record_id).first()
    if not record: raise HTTPException(404, "Not found")
    return {
        "id": record.id,
        "employee_name": record.employee.name if record.employee else None,
        "month": record.month, "year": record.year,
        "components_breakdown": record.components_breakdown,
        "net_salary": float(record.net_salary or 0),
        "status": record.status,
    }
