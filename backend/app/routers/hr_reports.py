from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import Optional
from datetime import date
from fastapi.responses import StreamingResponse
from app.database import get_db
from app.models import User
from app.auth import get_current_user
from app.hr_models import HRAttendanceRecord, HREmployee, HRLeaveBalance, HRLeaveType, HRPayrollRecord
import io, openpyxl
from openpyxl.styles import Font, PatternFill, Alignment

router = APIRouter()

STATUS_LABEL = {
    "present": "P", "late": "L", "absent": "A", "half_day": "H",
    "leave": "LV", "on_duty": "OD", "holiday": "HOL", "weekly_off": "WO"
}

def _get_employees(db, branch_id=None, department_id=None, employee_id=None):
    q = db.query(HREmployee).filter(HREmployee.is_active == True)
    if branch_id: q = q.filter(HREmployee.branch_id == branch_id)
    if department_id: q = q.filter(HREmployee.department_id == department_id)
    if employee_id: q = q.filter(HREmployee.id == employee_id)
    return q.order_by(HREmployee.name).all()

@router.get("/monthly")
def monthly_attendance(
    month: int, year: int,
    branch_id: Optional[int] = None,
    department_id: Optional[int] = None,
    employee_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    employees = _get_employees(db, branch_id, department_id, employee_id)
    emp_ids = [e.id for e in employees]

    records = db.query(HRAttendanceRecord).filter(
        HRAttendanceRecord.employee_id.in_(emp_ids),
        extract('month', HRAttendanceRecord.date) == month,
        extract('year', HRAttendanceRecord.date) == year,
    ).all()

    record_map = {}
    for r in records:
        record_map[(r.employee_id, str(r.date))] = r.status

    from calendar import monthrange
    days_in_month = monthrange(year, month)[1]

    result = []
    for emp in employees:
        row = {
            "employee_id": emp.id,
            "employee_code": emp.employee_id,
            "employee_name": emp.name,
            "department": emp.department.name if emp.department else None,
            "days": {}
        }
        summary = {"present": 0, "late": 0, "absent": 0, "half_day": 0,
                   "leave": 0, "on_duty": 0, "holiday": 0, "weekly_off": 0}
        for d in range(1, days_in_month + 1):
            day_str = f"{year}-{str(month).zfill(2)}-{str(d).zfill(2)}"
            status = record_map.get((emp.id, day_str), "absent")
            row["days"][day_str] = {"status": status, "label": STATUS_LABEL.get(status, "?")}
            if status in summary:
                summary[status] += 1
        row["summary"] = summary
        result.append(row)

    return result

@router.get("/late-arrivals")
def late_arrivals(
    month: int, year: int,
    branch_id: Optional[int] = None,
    department_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(HRAttendanceRecord).filter(
        HRAttendanceRecord.is_late == True,
        extract('month', HRAttendanceRecord.date) == month,
        extract('year', HRAttendanceRecord.date) == year,
    )
    records = q.all()
    return [{
        "employee_id": r.employee_id,
        "employee_name": r.employee.name if r.employee else None,
        "date": str(r.date),
        "check_in": str(r.check_in) if r.check_in else None,
        "late_minutes": r.late_minutes,
    } for r in records]

@router.get("/absenteeism")
def absenteeism_report(
    month: int, year: int,
    branch_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(HRAttendanceRecord).filter(
        HRAttendanceRecord.status == "absent",
        extract('month', HRAttendanceRecord.date) == month,
        extract('year', HRAttendanceRecord.date) == year,
    )
    records = q.all()
    return [{
        "employee_id": r.employee_id,
        "employee_name": r.employee.name if r.employee else None,
        "date": str(r.date),
    } for r in records]

@router.get("/leave-summary")
def leave_summary(
    year: int,
    branch_id: Optional[int] = None,
    department_id: Optional[int] = None,
    employee_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    employees = _get_employees(db, branch_id, department_id, employee_id)
    leave_types = db.query(HRLeaveType).filter(HRLeaveType.is_active == True).all()
    result = []
    for emp in employees:
        row = {"employee_id": emp.id, "employee_name": emp.name, "leave_types": {}}
        for lt in leave_types:
            balance = db.query(HRLeaveBalance).filter(
                HRLeaveBalance.employee_id == emp.id,
                HRLeaveBalance.leave_type_id == lt.id,
                HRLeaveBalance.year == year
            ).first()
            row["leave_types"][lt.code] = {
                "allocated": balance.allocated_days if balance else 0,
                "used": balance.used_days if balance else 0,
                "remaining": (balance.allocated_days - balance.used_days) if balance else 0,
            }
        result.append(row)
    return result

@router.get("/payroll-export")
def payroll_export(
    month: int, year: int,
    branch_id: Optional[int] = None,
    department_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    employees = _get_employees(db, branch_id, department_id)
    result = []
    for emp in employees:
        payroll = db.query(HRPayrollRecord).filter(
            HRPayrollRecord.employee_id == emp.id,
            HRPayrollRecord.month == month,
            HRPayrollRecord.year == year
        ).first()
        if payroll:
            result.append({
                "employee_id": emp.employee_id,
                "employee_name": emp.name,
                "designation": emp.designation,
                "working_days": payroll.working_days,
                "present_days": payroll.present_days,
                "absent_days": payroll.absent_days,
                "leave_days": payroll.leave_days,
                "lop_days": payroll.lop_days,
                "on_duty_days": payroll.on_duty_days,
                "basic_salary": float(payroll.basic_salary or 0),
                "total_earnings": float(payroll.total_earnings or 0),
                "total_deductions": float(payroll.total_deductions or 0),
                "net_salary": float(payroll.net_salary or 0),
                "status": payroll.status,
            })
    return result

@router.get("/payroll-export/excel")
def payroll_export_excel(
    month: int, year: int,
    branch_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    employees = _get_employees(db, branch_id)
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = f"Payroll {month}-{year}"

    headers = ["Emp ID", "Name", "Designation", "Working Days", "Present", "Absent", "Leave", "LOP", "On Duty", "Basic", "Earnings", "Deductions", "Net Salary"]
    header_fill = PatternFill("solid", fgColor="1a472a")
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")

    for row_num, emp in enumerate(employees, 2):
        payroll = db.query(HRPayrollRecord).filter(
            HRPayrollRecord.employee_id == emp.id,
            HRPayrollRecord.month == month,
            HRPayrollRecord.year == year
        ).first()
        ws.cell(row=row_num, column=1, value=emp.employee_id)
        ws.cell(row=row_num, column=2, value=emp.name)
        ws.cell(row=row_num, column=3, value=emp.designation)
        if payroll:
            ws.cell(row=row_num, column=4, value=payroll.working_days)
            ws.cell(row=row_num, column=5, value=payroll.present_days)
            ws.cell(row=row_num, column=6, value=payroll.absent_days)
            ws.cell(row=row_num, column=7, value=payroll.leave_days)
            ws.cell(row=row_num, column=8, value=payroll.lop_days)
            ws.cell(row=row_num, column=9, value=payroll.on_duty_days)
            ws.cell(row=row_num, column=10, value=float(payroll.basic_salary or 0))
            ws.cell(row=row_num, column=11, value=float(payroll.total_earnings or 0))
            ws.cell(row=row_num, column=12, value=float(payroll.total_deductions or 0))
            ws.cell(row=row_num, column=13, value=float(payroll.net_salary or 0))

    buf = io.BytesIO()
    wb.save(buf); buf.seek(0)
    filename = f"payroll_{year}_{str(month).zfill(2)}.xlsx"
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": f"attachment; filename={filename}"})
