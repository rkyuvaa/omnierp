from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from calendar import monthrange
from app.database import get_db
from app.models import User, FormDefinition
from app.auth import get_current_user, require_admin
from app.hr_models import HRPayrollRecord, HREmployee, HRAttendanceRecord, HRLeaveBalance, HRLeaveType, HRSalaryTemplate, HRSalaryComponent, HRArrearRecord, HRConfig, HRLeaveRequest
from app.routers.hr_config import get_hr_config
from app.utils.pdf import generate_payslip_html, render_to_pdf
from sqlalchemy import extract
from datetime import date

DAY_MAP = {0: "Mon", 1: "Tue", 2: "Wed", 3: "Thu", 4: "Fri", 5: "Sat", 6: "Sun"}

router = APIRouter()

MONTH_NAMES = ["","January","February","March","April","May","June",
               "July","August","September","October","November","December"]

class PayrollGenerate(BaseModel):
    employee_ids: list
    month: int
    year: int
    lop_calculation_base: Optional[str] = "gross"  # gross or ctc

class PayrollFinalize(BaseModel):
    month: int
    year: int
    branch_id: Optional[int] = None

class BulkDeleteRequest(BaseModel):
    record_ids: List[int]

class BulkUpdateRequest(BaseModel):
    record_ids: List[int]
    status: str


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


def _compute_lop_alert(db: Session, employee, lop_days: float, year: int):
    """Return an alert string if the employee has LOP but available paid leave balance."""
    if lop_days <= 0:
        return None
    balances = db.query(HRLeaveBalance).filter(
        HRLeaveBalance.employee_id == employee.id,
        HRLeaveBalance.year == year
    ).all()
    available = []
    for bal in balances:
        lt = bal.leave_type
        if lt and lt.is_paid and lt.code != "LOP" and lt.is_active:
            remaining = bal.allocated_days - bal.used_days
            if remaining > 0:
                available.append(f"{lt.name} ({remaining:.1f} days remaining)")
    if available:
        return "Has available paid leave that could cover LOP: " + ", ".join(available)
    return None


def _calculate_payroll(db: Session, employee: HREmployee, month: int, year: int, lop_base: str = "gross", arrears_held_list: list = None, arrears_paid_list: list = None) -> dict:
    # arrears_held_list/arrears_paid_list should be list of (amount, remarks)
    arrears_held_list = arrears_held_list or []
    arrears_paid_list = arrears_paid_list or []
    
    if not employee.is_active:
        earnings = {}
        deductions = {}
        employer_contributions = {}
        
        # Apply held list (deductions)
        for item in arrears_held_list:
            if len(item) == 3:
                amt, rem, status = item
            else:
                amt, rem = item
                status = "held"
                
            if amt > 0:
                if status == "one_time":
                    label = rem.strip() if rem and len(rem.strip()) > 0 else "One-time Deduction"
                else:
                    label = "Salary Held (Arrears)"
                deductions[label] = round(deductions.get(label, 0) + amt, 2)
                
        # Apply paid list (earnings / arrears payable)
        for amt, rem, h_month, h_year in arrears_paid_list:
            if amt > 0:
                m_name = MONTH_NAMES[h_month] if 0 < h_month < 13 else "Arrear"
                label = f"Arrear Payout ({m_name} {h_year})"
                earnings[label] = round(earnings.get(label, 0) + amt, 2)
                
        arrears_held_total = sum(a[0] for a in arrears_held_list)
        arrears_paid_total = sum(a[0] for a in arrears_paid_list)
        
        total_earnings = round(sum(earnings.values()), 2)
        total_deductions = round(sum(deductions.values()), 2)
        net_salary = round(max(0.0, total_earnings - total_deductions), 2)
        
        return {
            "working_days": 0,
            "present_days": 0,
            "absent_days": 0,
            "leave_days": 0,
            "lop_days": 0,
            "on_duty_days": 0,
            "basic_salary": 0,
            "total_earnings": total_earnings,
            "total_deductions": total_deductions,
            "net_salary": net_salary,
            "arrears_held": arrears_held_total,
            "arrears_paid": arrears_paid_total,
            "components_breakdown": {
                "earnings": earnings,
                "deductions": deductions,
                "employer_contributions": employer_contributions
            },
        }

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
    
    # Global Configs
    global_working_days = get_hr_config(db, "working_days", ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"])
    lop_calculation_base = get_hr_config(db, "lop_calculation_base", "gross") # gross, ctc, or net_pay
    lop_denominator_basis = get_hr_config(db, "lop_denominator_basis", "working_days") # calendar_days or working_days

    working_days_count = len([r for r in records if r.status not in ["holiday", "weekly_off"]])
    # If no attendance records found (e.g. month just started or not processed), 
    # fallback to global working days calculation for the month
    if working_days_count == 0:
        for d in range(1, days_in_month + 1):
            dt = date(year, month, d)
            if DAY_MAP[dt.weekday()] in global_working_days:
                working_days_count += 1


    # 1. Calculate Total Working Days in Month (Denominator)
    if lop_denominator_basis == "calendar_days":
        total_working_days_in_month = days_in_month
    else:
        total_working_days_in_month = 0
        for d in range(1, days_in_month + 1):
            dt = date(year, month, d)
            if DAY_MAP[dt.weekday()] in global_working_days:
                total_working_days_in_month += 1

    # Fetch leave balances for the employee for the current year
    balances = db.query(HRLeaveBalance).filter(
        HRLeaveBalance.employee_id == emp.id,
        HRLeaveBalance.year == year
    ).all()
    balance_map = {b.leave_type_id: b for b in balances}



    paid_leaves_by_type = {}

    # 2. Calculate LOP Days (Numerator subtraction)
    # We look at every day of the month.
    # If it's a working day and no record or absent -> LOP
    # If it's a non-working day but HR marked as absent -> LOP
    lop_days = 0
    present_days = 0
    half_days = 0
    leave_days = 0
    on_duty_days = 0
    absent_days_count = 0
    
    today = date.today()

    for d in range(1, days_in_month + 1):
        dt = date(year, month, d)
        d_str = str(dt)
        rec = next((r for r in records if r.date == dt), None)
        
        is_working_day = DAY_MAP[dt.weekday()] in global_working_days
        
        if rec:
            if rec.status in ["present", "late"]: present_days += 1
            elif rec.status == "half_day": half_days += 1
            elif rec.status == "on_duty": on_duty_days += 1
            elif rec.status in ["absent", "sandwich_lop"]: absent_days_count += 1
            
            # LOP Logic
            if rec.status in ["absent", "sandwich_lop"]:
                lop_days += 1
            elif rec.status == "half_day":
                lop_days += 0.5
            elif rec.status == "leave":
                # Check if it's paid leave
                is_paid_leave = True
                if rec.leave_request and rec.leave_request.leave_type:
                    is_paid_leave = rec.leave_request.leave_type.is_paid
                
                if is_paid_leave:
                    lt_id = rec.leave_request.leave_type_id if rec.leave_request else None
                    bal = balance_map.get(lt_id) if lt_id else None
                    
                    if lt_id:
                        paid_leaves_by_type[lt_id] = paid_leaves_by_type.get(lt_id, 0) + 1
                    
                    # Check 1: Exceeded monthly limit for this specific leave type?
                    exceeds_monthly = False
                    if bal and bal.monthly_limit and bal.monthly_limit > 0:
                        exceeds_monthly = (paid_leaves_by_type.get(lt_id, 0) > bal.monthly_limit)
                    
                    # Check 2: Exceeded yearly balance?
                    exceeds_yearly = False
                    if bal:
                        total_this_month = len([
                            r for r in records 
                            if r.status == "leave" 
                            and r.leave_request 
                            and r.leave_request.leave_type_id == lt_id 
                            and (r.leave_request.leave_type.is_paid if r.leave_request.leave_type else False)
                        ])
                        prior_used = max(0, bal.used_days - total_this_month)
                        allocated = bal.allocated_days
                        exceeds_yearly = (prior_used + paid_leaves_by_type[lt_id] > allocated)
                    
                    if exceeds_monthly or exceeds_yearly:
                        lop_days += 1
                    else:
                        leave_days += 1
                else:
                    lop_days += 1
        else:
            # No record. If it's a working day in the past, it's LOP
            if is_working_day and dt < today:
                lop_days += 1
                absent_days_count += 1

    # Detect: does the employee have LOP days BUT also has available paid leave balance?
    lop_alert = _compute_lop_alert(db, emp, lop_days, year)

    # Overrule LOP deduction for fixed salary employees
    if getattr(emp, "salary_category", "regular") == "fixed":
        lop_days = 0

    # 3. Calculate Salary based on chosen Method
    calc_method = get_hr_config(db, "salary_calculation_method", "pro_rata")
    
    if calc_method == "pro_rata":
        paid_days = total_working_days_in_month - lop_days
        if total_working_days_in_month > 0:
            effective_ctc = round(ctc * (paid_days / total_working_days_in_month), 2)
        else:
            effective_ctc = 0
        # Calculate components on EFFECTIVE CTC
        result_list, computed = _calculate_components(effective_ctc, components)
    else:
        # Calculate components on FULL CTC
        result_list, computed = _calculate_components(ctc, components)

    earnings = {}
    deductions = {}
    employer_contributions = {}
    for r in result_list:
        if r["component_type"] == "employer_contribution":
            employer_contributions[r["name"]] = r["amount"]
            continue
            
        if not r.get("show_on_payslip", True):
            continue
            
        if r["component_type"] == "earning":
            earnings[r["name"]] = r["amount"]
        else:
            deductions[r["name"]] = r["amount"]

    # 4. Handle Explicit LOP Deduction if using 'deduction' method
    if calc_method == "deduction" and lop_days > 0 and total_working_days_in_month > 0:
        full_gross_earnings = sum(earnings.values())
        
        # Calculate target net pay (excluding dynamic taxes like PT and TDS for LOP base)
        fixed_deductions = sum(amt for name, amt in deductions.items() if "PT" not in name.upper() and "PROFESSIONAL TAX" not in name.upper() and "TDS" not in name.upper() and "TAX" not in name.upper())
        target_net_pay = full_gross_earnings - fixed_deductions
        
        if lop_calculation_base == "gross":
            lop_deduction = round(full_gross_earnings * (lop_days / total_working_days_in_month), 2)
        elif lop_calculation_base == "net_pay":
            # Use the target net pay (excluding PT/TDS) instead of final net pay
            lop_deduction = round(target_net_pay * (lop_days / total_working_days_in_month), 2)
        else: # ctc
            lop_deduction = round(ctc * (lop_days / total_working_days_in_month), 2)
            
        if lop_deduction > 0:
            deductions["Loss of Pay (LOP)"] = lop_deduction

    total_earnings_base = round(sum(earnings.values()), 2)
    
    # 4. Handle Arrears (Add/Subtract after pro-rating)
    for item in arrears_held_list:
        if len(item) == 3:
            amt, rem, status = item
        else:
            amt, rem = item
            status = "held"
            
        if amt > 0:
            if status == "one_time":
                label = rem.strip() if rem and len(rem.strip()) > 0 else "One-time Deduction"
            else:
                label = "Salary Held (Arrears)"
            deductions[label] = round(deductions.get(label, 0) + amt, 2)
        
    for amt, rem, h_month, h_year in arrears_paid_list:
        if amt > 0:
            m_name = MONTH_NAMES[h_month] if 0 < h_month < 13 else "Arrear"
            label = f"Arrear Payout ({m_name} {h_year})"
            earnings[label] = round(earnings.get(label, 0) + amt, 2)

    arrears_held_total = sum(a[0] for a in arrears_held_list)
    arrears_paid_total = sum(a[0] for a in arrears_paid_list)

    total_earnings = round(sum(earnings.values()), 2)
    total_deductions = round(sum(deductions.values()), 2)
    net_salary = round(max(0.0, total_earnings - total_deductions), 2)

    return {
        "working_days": total_working_days_in_month,
        "present_days": present_days + (half_days * 0.5),
        "absent_days": absent_days_count,
        "leave_days": leave_days,
        "lop_days": lop_days,
        "on_duty_days": on_duty_days,
        "basic_salary": ctc,
        "total_earnings": total_earnings,
        "total_deductions": total_deductions,
        "net_salary": net_salary,
        "arrears_held": arrears_held_total,
        "arrears_paid": arrears_paid_total,
        "components_breakdown": {
            "earnings": earnings,
            "deductions": deductions,
            "employer_contributions": employer_contributions
        },
        "lop_alert": lop_alert,
    }





@router.get("/debug/{emp_id}")
def debug_payroll(emp_id: int, month: int, year: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
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
def generate_payroll(data: PayrollGenerate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
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
            HRArrearRecord.status.in_(["held", "one_time"])
        ).all()
        held_list = [(float(a.amount_held or 0), a.remarks, a.status) for a in arrears_held_records]

        arrears_paid_records = db.query(HRArrearRecord).filter(
            HRArrearRecord.employee_id == emp_id,
            HRArrearRecord.paid_in_month == data.month,
            HRArrearRecord.paid_in_year == data.year,
            HRArrearRecord.status == "paid"
        ).all()
        paid_list = [(float(a.amount_held or 0), a.remarks, a.held_month, a.held_year) for a in arrears_paid_records]

        # Check if the employee has any pending arrears from any month
        all_arrears = db.query(HRArrearRecord).filter(HRArrearRecord.employee_id == emp_id).all()
        has_any_pending = any(a.status in ["held", "one_time"] and float(a.amount_held or 0) > 0 for a in all_arrears)

        if not emp.is_active and not held_list and not paid_list and not has_any_pending:
            if existing and existing.status == "draft":
                db.delete(existing)
            results.append({"employee_id": emp_id, "status": "skipped", "reason": "Inactive and has no arrears"})
            continue

        calc = _calculate_payroll(db, emp, data.month, data.year, data.lop_calculation_base, held_list, paid_list)

        # lop_alert is a runtime flag only — not stored in DB
        lop_alert = calc.pop("lop_alert", None)

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
    from app.auth import is_hr_admin
    if not is_hr_admin(current_user, db):
        from app.auth import get_current_employee_optional
        emp_resolved = get_current_employee_optional(current_user, db)
        if not emp_resolved:
            return []
        q = db.query(HRPayrollRecord).filter(
            HRPayrollRecord.month == month,
            HRPayrollRecord.year == year,
            HRPayrollRecord.employee_id == emp_resolved.id
        )
    else:
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
            "arrears_paid": float(r.arrears_paid or 0),
            "components_breakdown": r.components_breakdown,
            "status": r.status,
            "lop_alert": _compute_lop_alert(db, r.employee, float(r.lop_days or 0), r.year),
        })
    
    response_data.sort(key=lambda x: (x["employee_name"] or "").lower())
    return response_data


# ── Helper functions for one-time deductions ──
def _process_one_time_deductions(db: Session, record: HRPayrollRecord):
    one_time_records = db.query(HRArrearRecord).filter(
        HRArrearRecord.employee_id == record.employee_id,
        HRArrearRecord.held_month == record.month,
        HRArrearRecord.held_year == record.year,
        HRArrearRecord.status == "one_time"
    ).all()
    
    if not one_time_records:
        return
        
    total_ot = sum(float(r.amount_held or 0) for r in one_time_records)
    total_other_deductions = max(0.0, float(record.total_deductions or 0) - total_ot)
    avail_earnings = max(0.0, float(record.total_earnings or 0) - total_other_deductions)
    
    for r in one_time_records:
        amt = float(r.amount_held or 0)
        if amt <= 0:
            r.status = "deducted"
            r.paid_in_month = record.month
            r.paid_in_year = record.year
            continue
            
        if avail_earnings >= amt:
            r.status = "deducted"
            r.paid_in_month = record.month
            r.paid_in_year = record.year
            avail_earnings -= amt
        else:
            deducted_amt = avail_earnings
            unpaid_amt = round(amt - deducted_amt, 2)
            avail_earnings = 0.0
            
            if deducted_amt > 0:
                part_deducted = HRArrearRecord(
                    employee_id=r.employee_id,
                    held_month=r.held_month,
                    held_year=r.held_year,
                    amount_held=deducted_amt,
                    status="deducted",
                    paid_in_month=record.month,
                    paid_in_year=record.year,
                    remarks=f"{r.remarks or 'One-time Deduction'} [Partially Deducted]"
                )
                db.add(part_deducted)
                
            next_month = record.month + 1
            next_year = record.year
            if next_month > 12:
                next_month = 1
                next_year += 1
                
            r.amount_held = unpaid_amt
            r.held_month = next_month
            r.held_year = next_year
            r.remarks = f"{r.remarks or 'One-time Deduction'} [Carried forward: unpaid ₹{unpaid_amt}]"

def _revert_one_time_deductions(db: Session, record: HRPayrollRecord):
    deducted_records = db.query(HRArrearRecord).filter(
        HRArrearRecord.employee_id == record.employee_id,
        HRArrearRecord.paid_in_month == record.month,
        HRArrearRecord.paid_in_year == record.year,
        HRArrearRecord.status == "deducted"
    ).all()
    
    next_month = record.month + 1
    next_year = record.year
    if next_month > 12:
        next_month = 1
        next_year += 1

    for r in deducted_records:
        if "[Partially Deducted]" in (r.remarks or ""):
            original = db.query(HRArrearRecord).filter(
                HRArrearRecord.employee_id == r.employee_id,
                HRArrearRecord.held_month == next_month,
                HRArrearRecord.held_year == next_year,
                HRArrearRecord.status == "one_time"
            ).first()
            if original:
                original.amount_held = round(float(original.amount_held or 0) + float(r.amount_held or 0), 2)
                original.held_month = record.month
                original.held_year = record.year
                original.remarks = (original.remarks or "").split(" [Carried forward:")[0]
            db.delete(r)
        else:
            r.status = "one_time"
            r.paid_in_month = None
            r.paid_in_year = None

    rolled_records = db.query(HRArrearRecord).filter(
        HRArrearRecord.employee_id == record.employee_id,
        HRArrearRecord.held_month == next_month,
        HRArrearRecord.held_year == next_year,
        HRArrearRecord.status == "one_time",
        HRArrearRecord.remarks.like("%[Carried forward: unpaid %")
    ).all()
    for r in rolled_records:
        r.held_month = record.month
        r.held_year = record.year
        r.remarks = (r.remarks or "").split(" [Carried forward:")[0]


@router.post("/{record_id}/finalize")
def finalize_payroll(record_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    record = db.query(HRPayrollRecord).filter(HRPayrollRecord.id == record_id).first()
    if not record: raise HTTPException(404, "Payroll record not found")
    if record.status != "finalized":
        record.status = "finalized"
        record.finalized_at = datetime.utcnow()
        _process_one_time_deductions(db, record)
        db.commit()
    return {"message": "Payroll finalized"}


@router.delete("/{record_id}")
def delete_payroll_record(record_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    record = db.query(HRPayrollRecord).filter(HRPayrollRecord.id == record_id).first()
    if not record: raise HTTPException(404, "Payroll record not found")
    if record.status == "finalized":
        _revert_one_time_deductions(db, record)
    db.delete(record)
    db.commit()
    return {"message": "Payroll record deleted"}


@router.post("/bulk-delete")
def bulk_delete_payroll(data: BulkDeleteRequest, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    if not data.record_ids:
        return {"message": "No records selected"}
    records = db.query(HRPayrollRecord).filter(HRPayrollRecord.id.in_(data.record_ids)).all()
    for record in records:
        if record.status == "finalized":
            _revert_one_time_deductions(db, record)
        db.delete(record)
    db.commit()
    return {"message": f"Deleted {len(data.record_ids)} records"}


@router.post("/bulk-update-status")
def bulk_update_payroll_status(data: BulkUpdateRequest, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    if not data.record_ids:
        return {"message": "No records selected"}
    
    if data.status == "finalized":
        records = db.query(HRPayrollRecord).filter(
            HRPayrollRecord.id.in_(data.record_ids),
            HRPayrollRecord.status != "finalized"
        ).all()
        for record in records:
            record.status = "finalized"
            record.finalized_at = datetime.utcnow()
            _process_one_time_deductions(db, record)
    else:
        records = db.query(HRPayrollRecord).filter(
            HRPayrollRecord.id.in_(data.record_ids),
            HRPayrollRecord.status == "finalized"
        ).all()
        for record in records:
            _revert_one_time_deductions(db, record)
            record.status = data.status
            record.finalized_at = None
            
        db.query(HRPayrollRecord).filter(
            HRPayrollRecord.id.in_(data.record_ids),
            HRPayrollRecord.status != "finalized"
        ).update({
            "status": data.status,
            "finalized_at": None
        }, synchronize_session=False)
        
    db.commit()
    return {"message": f"Updated {len(data.record_ids)} records to {data.status}"}


@router.get("/{record_id}")
def get_payroll_detail(record_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    record = db.query(HRPayrollRecord).filter(HRPayrollRecord.id == record_id).first()
    if not record: raise HTTPException(404, "Not found")
    from app.auth import is_hr_admin
    if not is_hr_admin(current_user, db):
        from app.auth import get_current_employee
        emp_resolved = get_current_employee(current_user, db)
        if record.employee_id != emp_resolved.id:
            raise HTTPException(status_code=403, detail="Access denied.")
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

def _generate_payslip_pdf_bytes(record, db: Session):
    employee = record.employee
    if not employee: return None

    # Load payslip branding from Studio → Documents → payroll module
    payroll_template = db.query(FormDefinition).filter(
        FormDefinition.module == "payroll",
        FormDefinition.is_active == True
    ).order_by(FormDefinition.id.desc()).first()
    
    pdf_cfg = payroll_template.pdf_config if payroll_template else {}
    fields_config = payroll_template.fields_config if payroll_template else []

    month_name = MONTH_NAMES[record.month]

    # ── Live arrear merge ──────────────────────────────────────────────────────
    # Always re-read live arrear data from DB so the payslip reflects the
    # current state, even if payroll was generated before an arrear was updated.
    # IMPORTANT: First fetch live DB records, then STRIP their equivalent labels
    # from the stored breakdown before re-adding, to avoid double-counting.
    breakdown = dict(record.components_breakdown or {})

    # ── Step 1: Fetch live arrear records from DB ──────────────────────────────
    live_held = db.query(HRArrearRecord).filter(
        HRArrearRecord.employee_id == employee.id,
        HRArrearRecord.held_month == record.month,
        HRArrearRecord.held_year == record.year,
        HRArrearRecord.status.in_(["held", "one_time"])
    ).all()

    live_paid = db.query(HRArrearRecord).filter(
        HRArrearRecord.employee_id == employee.id,
        HRArrearRecord.paid_in_month == record.month,
        HRArrearRecord.paid_in_year == record.year,
        HRArrearRecord.status == "paid"
    ).all()

    # ── Step 2: Build the set of labels that will come from DB ─────────────────
    # Remove these labels from the stored breakdown first (prevents double-count).
    db_deduction_labels = set()
    for a in live_held:
        if a.status == "one_time":
            db_deduction_labels.add((a.remarks or "").strip() or "One-time Deduction")
        else:
            db_deduction_labels.add("Salary Held (Arrears)")

    # "Arrear Payout (*)" entries in earnings are also always from DB
    stored_earnings = breakdown.get("earnings", {})
    stored_deductions = breakdown.get("deductions", {})

    # ── Step 3: Start with stored data minus any arrear-derived entries ─────────
    live_earnings = {k: v for k, v in stored_earnings.items() if "Arrear Payout" not in k}
    live_deductions = {k: v for k, v in stored_deductions.items() if k not in db_deduction_labels}

    # ── Step 4: Re-add fresh arrear data from DB ───────────────────────────────
    for a in live_held:
        amt = float(a.amount_held or 0)
        if amt <= 0:
            continue
        if a.status == "one_time":
            label = (a.remarks or "").strip() or "One-time Deduction"
        else:
            label = "Salary Held (Arrears)"
        live_deductions[label] = round(live_deductions.get(label, 0) + amt, 2)

    for a in live_paid:
        amt = float(a.amount_held or 0)
        if amt <= 0:
            continue
        h_month = a.held_month or 0
        h_year = a.held_year or 0
        m_name = MONTH_NAMES[h_month] if 0 < h_month < 13 else "Arrear"
        label = f"Arrear Payout ({m_name} {h_year})"
        live_earnings[label] = round(live_earnings.get(label, 0) + amt, 2)

    # ── Step 5: Rebuild record with corrected breakdown ────────────────────────
    class _PatchedRecord:
        pass
    patched = _PatchedRecord()
    patched.__dict__.update(record.__dict__)
    patched.components_breakdown = {
        "earnings": live_earnings,
        "deductions": live_deductions,
        "employer_contributions": breakdown.get("employer_contributions", {}),
    }
    patched.total_earnings = round(sum(live_earnings.values()), 2)
    patched.total_deductions = round(sum(live_deductions.values()), 2)
    patched.net_salary = round(max(0.0, patched.total_earnings - patched.total_deductions), 2)
    record = patched
    # ──────────────────────────────────────────────────────────────────────────

    # Calculate leave details for the current month
    start_date = date(record.year, record.month, 1)
    end_date = date(record.year, record.month, monthrange(record.year, record.month)[1])

    # Fetch all active leave types
    leave_types = db.query(HRLeaveType).filter(HRLeaveType.is_active == True).all()

    leave_summary = []
    for lt in leave_types:
        bal = db.query(HRLeaveBalance).filter(
            HRLeaveBalance.employee_id == employee.id,
            HRLeaveBalance.leave_type_id == lt.id,
            HRLeaveBalance.year == record.year
        ).first()

        allocated = bal.allocated_days if bal else 0.0
        used = bal.used_days if bal else 0.0
        remaining = (allocated - used) if bal else 0.0

        # Calculate leaves taken in the current month
        month_leaves = db.query(HRLeaveRequest).filter(
            HRLeaveRequest.employee_id == employee.id,
            HRLeaveRequest.leave_type_id == lt.id,
            HRLeaveRequest.status.in_(["approved", "auto_approved"]),
            HRLeaveRequest.from_date <= end_date,
            HRLeaveRequest.to_date >= start_date
        ).all()

        taken_this_month = 0.0
        for req in month_leaves:
            overlap_start = max(req.from_date, start_date)
            overlap_end = min(req.to_date, end_date)
            overlap_days = (overlap_end - overlap_start).days + 1
            if req.is_half_day:
                if overlap_days > 0:
                    taken_this_month += 0.5
            else:
                if req.from_date >= start_date and req.to_date <= end_date:
                    taken_this_month += req.total_days
                else:
                    taken_this_month += min(req.total_days, float(overlap_days))

        leave_summary.append({
            "name": lt.name,
            "code": lt.code,
            "allocated": allocated,
            "used": used,
            "taken_this_month": taken_this_month,
            "balance": remaining
        })

    # Fetch all PENDING held arrears for this employee (across all months)
    # These are informational — not re-deducted, just shown in payslip for reference.
    all_pending_holds = db.query(HRArrearRecord).filter(
        HRArrearRecord.employee_id == employee.id,
        HRArrearRecord.status == "held"
    ).order_by(HRArrearRecord.held_year, HRArrearRecord.held_month).all()
    pending_holds = [
        {
            "month": MONTH_NAMES[a.held_month] if 0 < a.held_month < 13 else "?",
            "year": a.held_year,
            "amount": float(a.amount_held or 0),
            "remarks": a.remarks or ""
        }
        for a in all_pending_holds if float(a.amount_held or 0) > 0
    ]

    html = generate_payslip_html(
        record, 
        employee, 
        month_name, 
        record.year, 
        pdf_cfg, 
        fields_config, 
        uan=employee.uan or "-", 
        leave_summary=leave_summary,
        esi_number=employee.esi_number or "-",
        pending_holds=pending_holds
    )
    return render_to_pdf(html)


class BulkSendPayslipsSchema(BaseModel):
    record_ids: List[int]


@router.get("/{record_id}/payslip")
def download_payslip(record_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Generate and return a payslip PDF for a payroll record."""
    record = db.query(HRPayrollRecord).filter(HRPayrollRecord.id == record_id).first()
    if not record: raise HTTPException(404, "Payroll record not found")
    from app.auth import is_hr_admin
    if not is_hr_admin(current_user, db):
        from app.auth import get_current_employee
        emp_resolved = get_current_employee(current_user, db)
        if record.employee_id != emp_resolved.id:
            raise HTTPException(status_code=403, detail="Access denied.")
    
    employee = record.employee
    if not employee: raise HTTPException(404, "Employee not found")

    pdf_bytes = _generate_payslip_pdf_bytes(record, db)
    if not pdf_bytes:
        raise HTTPException(500, "PDF generation failed")

    filename = f"Payslip_{employee.employee_id}_{MONTH_NAMES[record.month]}_{record.year}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.post("/{record_id}/send-payslip")
def email_payslip(record_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Generate and email payslip PDF to the employee."""
    record = db.query(HRPayrollRecord).filter(HRPayrollRecord.id == record_id).first()
    if not record: raise HTTPException(404, "Payroll record not found")
    
    employee = record.employee
    if not employee: raise HTTPException(404, "Employee not found")
    if not employee.email or "@" not in employee.email:
        raise HTTPException(400, f"Employee '{employee.name}' does not have a valid email address configured.")

    pdf_bytes = _generate_payslip_pdf_bytes(record, db)
    if not pdf_bytes:
        raise HTTPException(500, "PDF generation failed")

    from app.utils.email_service import send_template_email
    
    variables = {
        "employee_name": employee.name,
        "month": MONTH_NAMES[record.month],
        "year": str(record.year),
        "net_salary": f"{record.net_salary:,.2f}"
    }
    
    try:
        filename = f"Payslip_{employee.employee_id}_{MONTH_NAMES[record.month]}_{record.year}.pdf"
        send_template_email(
            db=db,
            to_email=employee.email,
            template_name="payslip_notification",
            variables=variables,
            attachment_bytes=pdf_bytes,
            attachment_filename=filename
        )
        return {"message": f"Payslip successfully emailed to {employee.email}"}
    except Exception as e:
        raise HTTPException(400, f"Failed to send email: {str(e)}")


@router.post("/bulk-send-payslips")
def bulk_email_payslips(data: BulkSendPayslipsSchema, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Bulk email payslips to multiple selected employees."""
    sent = 0
    failed = 0
    errors = []

    from app.utils.email_service import send_template_email

    for rid in data.record_ids:
        record = db.query(HRPayrollRecord).filter(HRPayrollRecord.id == rid).first()
        if not record:
            failed += 1
            errors.append(f"Record #{rid}: Not found")
            continue

        employee = record.employee
        if not employee:
            failed += 1
            errors.append(f"Record #{rid}: Employee not found")
            continue

        if not employee.email or "@" not in employee.email:
            failed += 1
            errors.append(f"{employee.name} ({employee.employee_id}): Missing email address")
            continue

        try:
            pdf_bytes = _generate_payslip_pdf_bytes(record, db)
            if not pdf_bytes:
                failed += 1
                errors.append(f"{employee.name} ({employee.employee_id}): PDF generation failed")
                continue

            variables = {
                "employee_name": employee.name,
                "month": MONTH_NAMES[record.month],
                "year": str(record.year),
                "net_salary": f"{record.net_salary:,.2f}"
            }
            
            filename = f"Payslip_{employee.employee_id}_{MONTH_NAMES[record.month]}_{record.year}.pdf"
            send_template_email(
                db=db,
                to_email=employee.email,
                template_name="payslip_notification",
                variables=variables,
                attachment_bytes=pdf_bytes,
                attachment_filename=filename
            )
            sent += 1
        except Exception as e:
            failed += 1
            errors.append(f"{employee.name} ({employee.employee_id}): {str(e)}")

    return {"sent": sent, "failed": failed, "errors": errors}

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

class ArrearManualRequest(BaseModel):
    employee_id: int
    amount: float
    type: str  # "add" or "deduct"
    target_month: int
    target_year: int
    original_month: Optional[int] = None
    original_year: Optional[int] = None
    remarks: Optional[str] = None

@router.post("/arrears/hold")
def hold_arrear(data: ArrearHoldRequest, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
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

@router.post("/arrears/manual")
def manual_arrear(data: ArrearManualRequest, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    if data.type == "add":
        orig_m = data.original_month or data.target_month
        orig_y = data.original_year or data.target_year
        arrear = HRArrearRecord(
            employee_id=data.employee_id,
            held_month=orig_m,
            held_year=orig_y,
            amount_held=data.amount,
            status="paid",
            paid_in_month=data.target_month,
            paid_in_year=data.target_year,
            remarks=data.remarks
        )
    elif data.type == "deduct":
        arrear = HRArrearRecord(
            employee_id=data.employee_id,
            held_month=data.target_month,
            held_year=data.target_year,
            amount_held=data.amount,
            status="held",
            remarks=data.remarks
        )
    elif data.type == "already_paid":
        orig_m = data.original_month or data.target_month
        orig_y = data.original_year or data.target_year
        arrear = HRArrearRecord(
            employee_id=data.employee_id,
            held_month=orig_m,
            held_year=orig_y,
            amount_held=data.amount,
            status="already_paid",
            remarks=data.remarks
        )
    elif data.type == "one_time":
        arrear = HRArrearRecord(
            employee_id=data.employee_id,
            held_month=data.target_month,
            held_year=data.target_year,
            amount_held=data.amount,
            status="one_time",
            remarks=data.remarks
        )
    elif data.type == "previously_held":
        orig_m = data.original_month or data.target_month
        orig_y = data.original_year or data.target_year
        arrear = HRArrearRecord(
            employee_id=data.employee_id,
            held_month=orig_m,
            held_year=orig_y,
            amount_held=data.amount,
            status="held",
            remarks=data.remarks
        )
    else:
        raise HTTPException(400, "Invalid type. Must be 'add', 'deduct', 'already_paid', 'one_time' or 'previously_held'")
        
    db.add(arrear)
    db.commit()
    return {"message": f"Arrear manual {data.type} created successfully", "arrear_id": arrear.id}

@router.post("/arrears/already-paid/{arrear_id}")
def mark_arrear_already_paid(arrear_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    arrear = db.query(HRArrearRecord).filter(HRArrearRecord.id == arrear_id).first()
    if not arrear:
        raise HTTPException(404, "Arrear record not found")
    if arrear.status != "held":
        raise HTTPException(400, "Only pending held arrears can be marked as already paid")
    
    arrear.status = "already_paid"
    # Append to remarks to indicate paid outside standard payroll
    p_remarks = " [Paid Outside Payroll]"
    arrear.remarks = (arrear.remarks or "").split(" [")[0] + p_remarks
    db.commit()
    return {"message": "Arrear marked as already paid successfully"}

@router.post("/arrears/pay")
def pay_arrears(data: ArrearPayRequest, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    arrear = db.query(HRArrearRecord).filter(HRArrearRecord.id == data.arrear_id).first()
    if not arrear: raise HTTPException(404, "Arrear record not found")
    if arrear.status != "held": raise HTTPException(400, "Arrear is already paid or cancelled")
    
    pay_amt = round(float(data.amount), 2)
    held_amt = round(float(arrear.amount_held or 0), 2)
    
    if pay_amt > held_amt:
        raise HTTPException(400, f"Cannot pay more than held amount (₹{held_amt})")

    # Get the base remarks (strip any previous payment history in brackets)
    base_remarks = (arrear.remarks or "").split(" [")[0]
    if not base_remarks or base_remarks == "None":
        base_remarks = "Arrear Payout"

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
            remarks=base_remarks # Use clean original remark
        )
        db.add(paid_record)
        
        # Update original record with remaining balance and track history
        arrear.amount_held = round(held_amt - pay_amt, 2)
        history_entry = f" [Rs.{pay_amt} paid in {data.pay_month}/{data.pay_year}]"
        arrear.remarks = (arrear.remarks or "") + history_entry
    else:
        # Full payout: Use clean original remark for the final paid state
        arrear.status = "paid"
        arrear.paid_in_month = data.pay_month
        arrear.paid_in_year = data.pay_year
        arrear.remarks = base_remarks

    db.commit()
    return {"message": "Arrear payout processed", "amount_paid": pay_amt}

@router.get("/arrears/pending-list")
def list_pending_arrears(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    # 1. Get distinct employee IDs from the arrear table to avoid complex join/distinct queries
    arrear_emp_ids = db.query(HRArrearRecord.employee_id).distinct().all()
    emp_ids = [r[0] for r in arrear_emp_ids if r[0] is not None]
    
    if not emp_ids:
        return []
        
    # 2. Fetch the corresponding employee records
    employees_with_arrears = db.query(HREmployee).filter(HREmployee.id.in_(emp_ids)).all()
    
    response_data = []
    for emp in employees_with_arrears:
        # 3. Get all arrear records for this employee
        arrears = db.query(HRArrearRecord).filter(HRArrearRecord.employee_id == emp.id).all()
        
        # Calculate pending amount (status in ['held', 'one_time'])
        total_pending = sum(float(a.amount_held or 0) for a in arrears if a.status in ["held", "one_time"])
        
        # Show employee only if they have a pending arrear amount > 0
        if total_pending > 0:
            response_data.append({
                "employee_id": emp.id,
                "name": emp.name,
                "code": emp.employee_id,
                "total_pending": round(total_pending, 2)
            })
            
    # Sort alphabetically by name
    response_data.sort(key=lambda x: (x["name"] or "").lower())
    return response_data

@router.get("/arrears/{employee_id}")
def get_employee_arrears(employee_id: int, status: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.auth import is_hr_admin
    if not is_hr_admin(current_user, db):
        from app.auth import get_current_employee_optional
        emp_resolved = get_current_employee_optional(current_user, db)
        if not emp_resolved or employee_id != emp_resolved.id:
            return []
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
        "paid_in_month": a.paid_in_month,
        "paid_in_year": a.paid_in_year,
        "remarks": a.remarks
    } for a in arrears]

@router.post("/arrears/revert/{arrear_id}")
def revert_arrear_payout(arrear_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    arrear = db.query(HRArrearRecord).filter(HRArrearRecord.id == arrear_id).first()
    if not arrear: raise HTTPException(404, "Arrear not found")
    if arrear.status != "paid": raise HTTPException(400, "Only paid arrears can be reverted")
    arrear.status = "held"
    arrear.paid_in_month = None
    arrear.paid_in_year = None
    db.commit()
    return {"message": "Payout reverted to held status"}

@router.delete("/arrears/{arrear_id}")
def delete_arrear(arrear_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    arrear = db.query(HRArrearRecord).filter(HRArrearRecord.id == arrear_id).first()
    if not arrear: raise HTTPException(404, "Arrear not found")
    db.delete(arrear)
    db.commit()
    return {"message": "Arrear record deleted"}
