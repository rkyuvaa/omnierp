from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from calendar import monthrange
from app.database import get_db
from app.models import User
from app.auth import get_current_user
from app.hr_models import HRPayrollRecord, HREmployee, HRAttendanceRecord, HRLeaveBalance, HRLeaveType, HRSalaryTemplate, HRSalaryComponent
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


def _resolve_components(db: Session, emp: HREmployee):
    """
    Resolve salary components for an employee.
    Priority: employee.salary_template_id → employee.salary_components (legacy JSON)
    """
    if emp.salary_template_id:
        template = db.query(HRSalaryTemplate).filter(HRSalaryTemplate.id == emp.salary_template_id).first()
        if template and template.components:
            resolved = []
            for item in template.components:
                cid = item.get("component_id")
                override = item.get("override_value")
                comp = db.query(HRSalaryComponent).filter(
                    HRSalaryComponent.id == cid,
                    HRSalaryComponent.is_active == True
                ).first()
                if comp:
                    resolved.append({
                        "name": comp.name,
                        "code": comp.code,
                        "component_type": comp.component_type,
                        "calc_type": comp.calc_type,
                        "calc_value": override if override is not None else comp.calc_value,
                        "show_on_payslip": comp.show_on_payslip,
                        "sort_order": comp.sort_order,
                    })
            return sorted(resolved, key=lambda x: x["sort_order"])

    # Legacy: use salary_components JSON on employee
    legacy = []
    for comp in (emp.salary_components or []):
        legacy.append({
            "name": comp.get("name", ""),
            "code": comp.get("name", "").upper().replace(" ", "_"),
            "component_type": comp.get("type", "earning"),
            "calc_type": "percentage_of_ctc" if comp.get("is_percentage") else "fixed",
            "calc_value": comp.get("value", 0),
            "show_on_payslip": True,
            "sort_order": 99,
        })
    return legacy


def _calculate_components(ctc: float, components: list):
    """
    Calculate each component in dependency order.
    - percentage_of_ctc  → % of Salary (CTC)
    - percentage_of_basic → % of BASIC component
    - percentage_of_gross → % of total earnings so far
    - fixed               → fixed amount
    Returns (result_list, computed_dict)
    """
    computed = {"CTC": ctc}
    result_list = []

    for comp in components:
        calc_type = comp["calc_type"]
        val = float(comp["calc_value"] or 0)

        if calc_type == "percentage_of_ctc":
            amount = round(ctc * val / 100, 2)
        elif calc_type == "percentage_of_basic":
            basic = computed.get("BASIC", 0)
            amount = round(basic * val / 100, 2)
        elif calc_type == "percentage_of_gross":
            gross = sum(r["amount"] for r in result_list if r["component_type"] == "earning")
            amount = round(gross * val / 100, 2)
        else:  # fixed
            amount = round(val, 2)

        code = comp.get("code", comp["name"].upper().replace(" ", "_"))
        computed[code] = amount
        result_list.append({**comp, "amount": amount})

    return result_list, computed


def _calculate_payroll(db: Session, emp: HREmployee, month: int, year: int) -> dict:
    """Calculate salary for one employee for a given month"""
    ctc = float(emp.basic_salary or 0)
    components = _resolve_components(db, emp)

    # Attendance summary
    records = db.query(HRAttendanceRecord).filter(
        HRAttendanceRecord.employee_id == emp.id,
        extract('month', HRAttendanceRecord.date) == month,
        extract('year', HRAttendanceRecord.date) == year,
    ).all()

    days_in_month = monthrange(year, month)[1]
    working_days = len([r for r in records if r.status not in ["holiday", "weekly_off"]])
    present_days = len([r for r in records if r.status in ["present", "late"]])
    half_days = len([r for r in records if r.status == "half_day"])
    leave_days = len([r for r in records if r.status == "leave"])
    on_duty_days = len([r for r in records if r.status == "on_duty"])
    absent_days = len([r for r in records if r.status == "absent"])

    # LOP
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

    # Prorated CTC for month
    effective = present_days + on_duty_days + (half_days * 0.5) + leave_days
    total_payable_days = working_days if working_days > 0 else days_in_month
    attendance_ratio = effective / total_payable_days if total_payable_days > 0 else 1.0
    payable_ctc = round(ctc * attendance_ratio, 2)
    lop_deduction = round(ctc * (lop_days / total_payable_days), 2) if total_payable_days > 0 else 0

    # Calculate components
    result_list, computed = _calculate_components(payable_ctc, components)

    earnings = {}
    deductions = {}
    for r in result_list:
        if not r.get("show_on_payslip", True):
            continue
        if r["component_type"] == "earning":
            earnings[r["name"]] = r["amount"]
        else:
            deductions[r["name"]] = r["amount"]

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
        "basic_salary": payable_ctc,
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
            record = HRPayrollRecord(employee_id=emp_id, year=data.year, month=data.month, **calc)
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
