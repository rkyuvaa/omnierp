from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from calendar import monthrange
from app.database import get_db
from app.models import User, FormDefinition
from app.auth import get_current_user
from app.hr_models import HRPayrollRecord, HREmployee, HRAttendanceRecord, HRLeaveBalance, HRLeaveType, HRSalaryTemplate, HRSalaryComponent, HRArrearRecord
from app.utils.pdf import generate_payslip_html, render_to_pdf
from sqlalchemy import extract

router = APIRouter()

class PayrollGenerate(BaseModel):
    employee_ids: list
    month: int
    year: int
    lop_calculation_base: Optional[str] = "gross"  # gross or ctc

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
                # The template stores override in "value" field, not "override_value"
                override_val = item.get("value")
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
                        "calc_value": override_val if override_val is not None else comp.calc_value,
                        "cap_amount": comp.cap_amount,
                        "slabs": comp.slabs,
                        "apply_if_gross_below": comp.apply_if_gross_below,
                        "apply_if_gross_above": comp.apply_if_gross_above,
                        "show_on_payslip": comp.show_on_payslip,
                        "sort_order": comp.sort_order,
                    })
            return sorted(resolved, key=lambda x: x["sort_order"])

    # Legacy: use salary_components JSON on employee
    legacy = []
    for comp in (emp.salary_components or []):
        legacy.append({
            "name": comp.get("name", ""),
            "code": comp.get("code", comp.get("name", "").upper().replace(" ", "_")),
            "component_type": comp.get("type", comp.get("component_type", "earning")),
            "calc_type": comp.get("calc_type", "percentage_of_ctc" if comp.get("is_percentage") else "fixed"),
            "calc_value": comp.get("value", 0),
            "cap_amount": comp.get("cap_amount"),
            "slabs": comp.get("slabs"),
            "apply_if_gross_below": comp.get("apply_if_gross_below"),
            "apply_if_gross_above": comp.get("apply_if_gross_above"),
            "show_on_payslip": comp.get("show_on_payslip", True),
            "sort_order": comp.get("sort_order", 99),
        })
    return legacy


def _calculate_components(ctc: float, components: list):
    """
    Calculate each component in dependency order.
    - percentage_of_ctc   → % of Salary (CTC)
    - percentage_of_basic → % of BASIC component (with optional cap)
    - percentage_of_gross → % of total earnings so far (with optional cap)
    - slab                → lookup gross in slab table
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
            # Robust matching: try BASIC, BASIC_SALARY, or find by name
            base = computed.get("BASIC", computed.get("BASIC_SALARY", 0))
            if not base:
                basic_item = next((r for r in result_list if "basic" in r.get("name", "").lower()), None)
                if basic_item:
                    base = basic_item["amount"]
            if comp.get("cap_amount"):
                base = min(base, float(comp["cap_amount"]))
            amount = round(base * val / 100, 2)
        elif calc_type == "percentage_of_gross":
            base = sum(r["amount"] for r in result_list if r["component_type"] == "earning")
            if comp.get("cap_amount"):
                base = min(base, float(comp["cap_amount"]))
            amount = round(base * val / 100, 2)
        elif calc_type == "slab":
            gross = sum(r["amount"] for r in result_list if r["component_type"] == "earning")
            amount = 0
            if comp.get("slabs"):
                for slab in comp["slabs"]:
                    s_min = float(slab.get("min", 0))
                    s_max = slab.get("max")
                    if s_max is None: s_max = float('inf')
                    else: s_max = float(s_max)
                    
                    if s_min <= gross <= s_max:
                        amount = float(slab.get("value", 0))
                        break
        else:  # fixed
            amount = round(val, 2)

        # Gross threshold checks (ESI: apply only if gross ≤ 21000, TDS: apply only if gross ≥ 1L, etc.)
        gross_earnings = sum(r["amount"] for r in result_list if r["component_type"] == "earning")
        threshold_below = comp.get("apply_if_gross_below")
        threshold_above = comp.get("apply_if_gross_above")
        if threshold_below is not None and gross_earnings > float(threshold_below):
            amount = 0  # e.g. ESI not applicable when gross > 21000
        if threshold_above is not None and gross_earnings < float(threshold_above):
            amount = 0  # e.g. TDS not applicable when gross < 1,00,000

        code = comp.get("code", comp["name"].upper().replace(" ", "_"))
        computed[code] = amount
        result_list.append({**comp, "amount": amount})

    return result_list, computed


def _calculate_payroll(db: Session, employee: HREmployee, month: int, year: int, lop_base: str = "gross", arrears_held_list: list = None, arrears_paid_list: list = None) -> dict:
    # arrears_held_list/arrears_paid_list should be list of (amount, remarks)
    arrears_held_list = arrears_held_list or []
    arrears_paid_list = arrears_paid_list or []
    emp = employee
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

    # LOP (Manual + Excess Leave)
    lop_type = db.query(HRLeaveType).filter(HRLeaveType.code == "LOP").first()
    lop_days = absent_days
    if lop_type:
        balance = db.query(HRLeaveBalance).filter(
            HRLeaveBalance.employee_id == emp.id,
            HRLeaveBalance.leave_type_id == lop_type.id,
            HRLeaveBalance.year == year,
        ).first()
        if balance:
            lop_days += balance.used_days

    # Calculate components on FULL CTC (100% attendance base) to avoid double deduction
    # LOP will be handled as an explicit deduction
    result_list, computed = _calculate_components(ctc, components)

    earnings = {}
    deductions = {}
    for r in result_list:
        if not r.get("show_on_payslip", True):
            continue
        if r["component_type"] == "earning":
            earnings[r["name"]] = r["amount"]
        else:
            deductions[r["name"]] = r["amount"]

    full_gross_earnings = sum(earnings.values())
    total_payable_days = working_days if working_days > 0 else days_in_month
    
    # Calculate LOP Deduction based on chosen base
    lop_deduction = 0
    if total_payable_days > 0 and lop_days > 0:
        if lop_calculation_base == "gross":
            lop_deduction = round(full_gross_earnings * (lop_days / total_payable_days), 2)
        else: # ctc
            lop_deduction = round(ctc * (lop_days / total_payable_days), 2)
            
    if lop_deduction > 0:
        deductions["Loss of Pay (LOP)"] = lop_deduction

    for amt, rem in arrears_held_list:
        if amt > 0:
            label = rem if rem else "Salary Held (Arrears)"
            label = label.replace("₹", "Rs.")
            deductions[label] = amt
        
    for amt, rem in arrears_paid_list:
        if amt > 0:
            label = rem if rem else "Arrears Payout"
            label = label.replace("₹", "Rs.")
            earnings[label] = amt

    arrears_held_total = sum(a[0] for a in arrears_held_list)
    arrears_paid_total = sum(a[0] for a in arrears_paid_list)

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
        "basic_salary": ctc,
        "total_earnings": total_earnings,
        "total_deductions": total_deductions,
        "net_salary": net_salary,
        "arrears_held": arrears_held_total,
        "arrears_paid": arrears_paid_total,
        "components_breakdown": {"earnings": earnings, "deductions": deductions},
    }


@router.get("/debug/{emp_id}")
def debug_payroll(emp_id: int, month: int, year: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Debug endpoint to inspect salary component resolution for an employee"""
    emp = db.query(HREmployee).filter(HREmployee.id == emp_id).first()
    if not emp:
        raise HTTPException(404, "Employee not found")
    
    components = _resolve_components(db, emp)
    ctc = float(emp.basic_salary or 0)
    result_list, computed = _calculate_components(ctc, components)
    
    return {
        "employee": emp.name,
        "employee_id": emp.employee_id,
        "ctc": ctc,
        "salary_template_id": emp.salary_template_id,
        "raw_salary_components": emp.salary_components,
        "resolved_components": components,
        "calculated": result_list,
        "computed_dict": computed,
    }


@router.post("/generate")
def generate_payroll(data: PayrollGenerate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    results = []
    for emp_id in data.employee_ids:
        emp = db.query(HREmployee).filter(HREmployee.id == emp_id).first()
        if not emp: continue

        existing = db.query(HRPayrollRecord).filter(
            HRPayrollRecord.employee_id == emp_id,
            HRPayrollRecord.month == data.month,
            HRPayrollRecord.year == data.year,
        ).first()

        if existing and existing.status == "finalized":
            results.append({"employee_id": emp_id, "status": "skipped", "reason": "Already finalized"})
            continue

        # Automatically apply Arrears from the HRArrearRecord table
        arrears_held_records = db.query(HRArrearRecord).filter(
            HRArrearRecord.employee_id == emp_id,
            HRArrearRecord.held_month == data.month,
            HRArrearRecord.held_year == data.year,
            HRArrearRecord.status == "held"
        ).all()
        held_list = [(float(a.amount_held or 0), a.remarks) for a in arrears_held_records]

        arrears_paid_records = db.query(HRArrearRecord).filter(
            HRArrearRecord.employee_id == emp_id,
            HRArrearRecord.paid_in_month == data.month,
            HRArrearRecord.paid_in_year == data.year,
            HRArrearRecord.status == "paid"
        ).all()
        paid_list = [(float(a.amount_held or 0), a.remarks) for a in arrears_paid_records]

        calc = _calculate_payroll(db, emp, data.month, data.year, data.lop_calculation_base, held_list, paid_list)

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
    
    # Filter out orphaned records where employee was deleted
    valid_records = [r for r in records if r.employee]
    
    response_data = []
    for r in valid_records:
        pending_arrears = db.query(HRArrearRecord).filter(
            HRArrearRecord.employee_id == r.employee_id,
            HRArrearRecord.status == "held"
        ).all()
        pending_total = sum(float(a.amount_held or 0) for a in pending_arrears)

        response_data.append({
            "id": r.id,
            "employee_id": r.employee_id,
            "employee_code": r.employee.employee_id,
            "employee_name": r.employee.name,
            "designation": r.employee.designation,
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
            "pending_arrears": pending_total,
            "components_breakdown": r.components_breakdown,
            "status": r.status,
        })
    
    return response_data


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


MONTH_NAMES = ["","January","February","March","April","May","June",
               "July","August","September","October","November","December"]

@router.get("/{record_id}/payslip")
def download_payslip(record_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Generate and return a payslip PDF for a payroll record."""
    record = db.query(HRPayrollRecord).filter(HRPayrollRecord.id == record_id).first()
    if not record: raise HTTPException(404, "Payroll record not found")
    
    employee = record.employee
    if not employee: raise HTTPException(404, "Employee not found")

    # Load payslip branding from Studio → Documents → payroll module
    payroll_template = db.query(FormDefinition).filter(
        FormDefinition.module == "payroll",
        FormDefinition.is_active == True
    ).order_by(FormDefinition.id.desc()).first()
    
    pdf_cfg = payroll_template.pdf_config if payroll_template else {}
    fields_config = payroll_template.fields_config if payroll_template else []

    month_name = MONTH_NAMES[record.month]
    html = generate_payslip_html(record, employee, month_name, record.year, pdf_cfg, fields_config)
    pdf_bytes = render_to_pdf(html)

    if not pdf_bytes:
        raise HTTPException(500, "PDF generation failed")

    filename = f"Payslip_{employee.employee_id}_{month_name}_{record.year}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

class ArrearHoldRequest(BaseModel):
    employee_id: int
    amount: float
    month: int
    year: int
    remarks: Optional[str] = None

class ArrearPayRequest(BaseModel):
    arrear_id: int
    amount: float
    pay_month: int
    pay_year: int

@router.post("/arrears/hold")
def hold_arrear(data: ArrearHoldRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    arrear = HRArrearRecord(
        employee_id=data.employee_id,
        held_month=data.month,
        held_year=data.year,
        amount_held=data.amount,
        status="held",
        remarks=data.remarks
    )
    db.add(arrear)
    db.commit()
    return {"message": "Arrear held successfully", "arrear_id": arrear.id}

@router.post("/arrears/pay")
def pay_arrears(data: ArrearPayRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    arrear = db.query(HRArrearRecord).filter(HRArrearRecord.id == data.arrear_id).first()
    if not arrear: raise HTTPException(404, "Arrear record not found")
    if arrear.status != "held": raise HTTPException(400, "Arrear is already paid or cancelled")
    
    pay_amt = round(float(data.amount), 2)
    held_amt = round(float(arrear.amount_held or 0), 2)
    
    if pay_amt > held_amt:
        raise HTTPException(400, f"Cannot pay more than held amount (₹{held_amt})")

    if pay_amt < held_amt:
        # Partial payout: Create a NEW record for the paid part, and keep balance in original
        paid_record = HRArrearRecord(
            employee_id=arrear.employee_id,
            held_month=arrear.held_month,
            held_year=arrear.held_year,
            amount_held=pay_amt,
            status="paid",
            paid_in_month=data.pay_month,
            paid_in_year=data.pay_year,
            remarks=f"Partial payout from Rs.{held_amt} hold"
        )
        db.add(paid_record)
        
        # Update original record with remaining balance
        arrear.amount_held = round(held_amt - pay_amt, 2)
        arrear.remarks = (arrear.remarks or "") + f" [Rs.{pay_amt} paid in {data.pay_month}/{data.pay_year}]"
    else:
        # Full payout
        arrear.status = "paid"
        arrear.paid_in_month = data.pay_month
        arrear.paid_in_year = data.pay_year

    db.commit()
    return {"message": "Arrear payout processed", "amount_paid": pay_amt}

@router.get("/arrears/pending-list")
def list_pending_arrears(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Return all employees who have pending arrears balance."""
    # Group by employee to show total pending per person
    from sqlalchemy import func
    results = db.query(
        HRArrearRecord.employee_id,
        HREmployee.name,
        HREmployee.employee_id.label("code"),
        func.sum(HRArrearRecord.amount_held).label("total_pending")
    ).join(HREmployee, HRArrearRecord.employee_id == HREmployee.id)\
     .filter(HRArrearRecord.status == "held")\
     .group_by(HRArrearRecord.employee_id, HREmployee.name, HREmployee.employee_id)\
     .all()
     
    return [{
        "employee_id": r.employee_id,
        "name": r.name,
        "code": r.code,
        "total_pending": float(r.total_pending or 0)
    } for r in results]

@router.get("/arrears/{employee_id}")
def get_employee_arrears(employee_id: int, status: Optional[str] = "held", db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(HRArrearRecord).filter(HRArrearRecord.employee_id == employee_id)
    if status:
        q = q.filter(HRArrearRecord.status == status)
    arrears = q.all()
    return [{
        "id": a.id,
        "amount_held": float(a.amount_held or 0),
        "held_month": a.held_month,
        "held_year": a.held_year,
        "status": a.status,
        "remarks": a.remarks
    } for a in arrears]
