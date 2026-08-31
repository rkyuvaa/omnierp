from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import extract, func, or_
from typing import Optional, List
from datetime import date, datetime
from app.database import get_db
from app.models import User
from app.auth import get_current_user
from app.hr_models import (
    HRLeaveRequest, HRLeaveType, HRLeaveBalance,
    HREmployee, HRAttendanceRecord
)
from app.utils.rbac import check_permission, apply_data_scope

router = APIRouter()

@router.get("/taken-summary")
def get_leave_taken_summary(
    employee_id: Optional[int] = None,
    branch_id: Optional[int] = None,
    department_id: Optional[int] = None,
    leave_type_id: Optional[int] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not check_permission(current_user, db, "hr", "/hr/leave-ledger", "read"):
        raise HTTPException(status_code=403, detail="Permission denied to access Leave Ledger")

    query = db.query(HRLeaveRequest).join(HREmployee, HRLeaveRequest.employee_id == HREmployee.id)
    query = apply_data_scope(query, HRLeaveRequest, current_user, db, "hr")

    if employee_id:
        query = query.filter(HRLeaveRequest.employee_id == employee_id)
    if branch_id:
        query = query.filter(HREmployee.branch_id == branch_id)
    if department_id:
        query = query.filter(HREmployee.department_id == department_id)
    if leave_type_id:
        query = query.filter(HRLeaveRequest.leave_type_id == leave_type_id)
    if from_date:
        query = query.filter(HRLeaveRequest.from_date >= from_date)
    if to_date:
        query = query.filter(HRLeaveRequest.to_date <= to_date)
    if status:
        query = query.filter(HRLeaveRequest.status == status)

    requests = query.order_by(HRLeaveRequest.from_date.desc()).all()

    result = []
    for req in requests:
        emp = req.employee
        lt = req.leave_type
        result.append({
            "id": f"req_{req.id}",
            "reference": req.reference,
            "employee_id": req.employee_id,
            "employee_name": emp.name if emp else "Unknown",
            "employee_code": emp.employee_id if emp else "",
            "department_name": emp.department.name if emp and emp.department else "-",
            "branch_name": emp.branch.name if emp and emp.branch else "-",
            "leave_type_id": req.leave_type_id,
            "leave_type_name": lt.name if lt else "Leave",
            "leave_type_code": lt.code if lt else "LV",
            "from_date": str(req.from_date),
            "to_date": str(req.to_date),
            "total_days": req.total_days,
            "is_half_day": req.is_half_day,
            "half_day_session": req.half_day_session,
            "reason": req.reason,
            "status": req.status,
            "approved_at": str(req.approved_at) if req.approved_at else None,
            "created_at": str(req.created_at) if req.created_at else None,
        })

    # If status filter permits, include unapproved absent attendance records
    if not status or status.lower() == 'absent':
        att_query = db.query(HRAttendanceRecord).join(HREmployee, HRAttendanceRecord.employee_id == HREmployee.id).filter(
            HRAttendanceRecord.status == 'absent',
            HRAttendanceRecord.leave_request_id == None
        )
        att_query = apply_data_scope(att_query, HRAttendanceRecord, current_user, db, "hr")

        if employee_id:
            att_query = att_query.filter(HRAttendanceRecord.employee_id == employee_id)
        if branch_id:
            att_query = att_query.filter(HREmployee.branch_id == branch_id)
        if department_id:
            att_query = att_query.filter(HREmployee.department_id == department_id)
        if from_date:
            att_query = att_query.filter(HRAttendanceRecord.date >= from_date)
        if to_date:
            att_query = att_query.filter(HRAttendanceRecord.date <= to_date)

        absent_records = att_query.order_by(HRAttendanceRecord.date.desc()).all()
        for att in absent_records:
            emp = att.employee
            result.append({
                "id": f"abs_{att.id}",
                "reference": f"ABS-{att.id}",
                "employee_id": att.employee_id,
                "employee_name": emp.name if emp else "Unknown",
                "employee_code": emp.employee_id if emp else "",
                "department_name": emp.department.name if emp and emp.department else "-",
                "branch_name": emp.branch.name if emp and emp.branch else "-",
                "leave_type_id": None,
                "leave_type_name": "Unapproved Absent",
                "leave_type_code": "ABS",
                "from_date": str(att.date),
                "to_date": str(att.date),
                "total_days": 1.0,
                "is_half_day": False,
                "half_day_session": None,
                "reason": att.correction_reason or "Absent (No leave applied)",
                "status": "absent",
                "approved_at": None,
                "created_at": str(att.created_at) if att.created_at else None,
            })

    result.sort(key=lambda x: x["from_date"], reverse=True)
    return result

@router.get("/compoff-summary")
def get_compoff_summary(
    employee_id: Optional[int] = None,
    branch_id: Optional[int] = None,
    department_id: Optional[int] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not check_permission(current_user, db, "hr", "/hr/leave-ledger", "read"):
        raise HTTPException(status_code=403, detail="Permission denied")

    query = db.query(HRAttendanceRecord).join(HREmployee, HRAttendanceRecord.employee_id == HREmployee.id).filter(
        HRAttendanceRecord.comp_off_hours > 0
    )
    query = apply_data_scope(query, HRAttendanceRecord, current_user, db, "hr")

    if employee_id:
        query = query.filter(HRAttendanceRecord.employee_id == employee_id)
    if branch_id:
        query = query.filter(HREmployee.branch_id == branch_id)
    if department_id:
        query = query.filter(HREmployee.department_id == department_id)
    if from_date:
        query = query.filter(HRAttendanceRecord.date >= from_date)
    if to_date:
        query = query.filter(HRAttendanceRecord.date <= to_date)

    records = query.order_by(HRAttendanceRecord.date.desc()).all()

    result = []
    for r in records:
        emp = r.employee
        days_earned = round(r.comp_off_hours / 8.0, 2)
        result.append({
            "id": r.id,
            "employee_id": r.employee_id,
            "employee_name": emp.name if emp else "Unknown",
            "employee_code": emp.employee_id if emp else "",
            "department_name": emp.department.name if emp and emp.department else "-",
            "branch_name": emp.branch.name if emp and emp.branch else "-",
            "date": str(r.date),
            "hours_worked": r.hours_worked,
            "comp_off_hours": r.comp_off_hours,
            "comp_off_days_earned": days_earned if days_earned > 0 else 0.5,
            "status": r.status,
            "check_in": str(r.check_in) if r.check_in else None,
            "check_out": str(r.check_out) if r.check_out else None,
        })

    return result

@router.get("/balance-ledger")
def get_balance_ledger(
    employee_id: Optional[int] = None,
    year: Optional[int] = Query(default=None),
    branch_id: Optional[int] = None,
    department_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not check_permission(current_user, db, "hr", "/hr/leave-ledger", "read"):
        raise HTTPException(status_code=403, detail="Permission denied")

    target_year = year or datetime.utcnow().year
    emp_query = db.query(HREmployee).filter(HREmployee.is_active == True)
    emp_query = apply_data_scope(emp_query, HREmployee, current_user, db, "hr", emp_id_attr="id")

    if employee_id:
        emp_query = emp_query.filter(HREmployee.id == employee_id)
    if branch_id:
        emp_query = emp_query.filter(HREmployee.branch_id == branch_id)
    if department_id:
        emp_query = emp_query.filter(HREmployee.department_id == department_id)

    employees = emp_query.order_by(HREmployee.name.asc()).all()
    leave_types = db.query(HRLeaveType).filter(HRLeaveType.is_active == True).all()

    ledger = []

    for emp in employees:
        balances = db.query(HRLeaveBalance).filter(
            HRLeaveBalance.employee_id == emp.id,
            HRLeaveBalance.year == target_year
        ).all()

        bal_map = {b.leave_type_id: b for b in balances}
        
        type_breakdown = []
        total_allocated = 0.0
        total_used = 0.0
        total_balance = 0.0

        for lt in leave_types:
            b = bal_map.get(lt.id)
            allocated = b.allocated_days if b else lt.max_days_per_year
            used = b.used_days if b else 0.0
            carry = b.carry_forwarded if b else 0.0
            available = max(0.0, (allocated + carry) - used)

            total_allocated += allocated + carry
            total_used += used
            total_balance += available

            type_breakdown.append({
                "leave_type_id": lt.id,
                "leave_type_name": lt.name,
                "leave_type_code": lt.code,
                "allocated_days": allocated,
                "carry_forwarded": carry,
                "used_days": used,
                "available_balance": available
            })

        ledger.append({
            "employee_id": emp.id,
            "employee_name": emp.name,
            "employee_code": emp.employee_id,
            "department_name": emp.department.name if emp.department else "-",
            "branch_name": emp.branch.name if emp.branch else "-",
            "year": target_year,
            "total_allocated": total_allocated,
            "total_used": total_used,
            "total_available": total_balance,
            "leave_breakdown": type_breakdown
        })

    return ledger
