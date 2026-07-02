from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime, timedelta
from app.database import get_db, SessionLocal
from app.models import User
from app.auth import get_current_user, require_admin
from app.routers.hr_config import get_hr_config
from app.hr_models import (
    HRLeaveType, HRLeaveBalance, HRLeaveRequest,
    HREmployee, HRAttendanceRecord, HRNotification
)
from app.utils.push_service import send_push_to_user

router = APIRouter()

# ── Leave Type Schemas ──────────────────────────────────────────────────────
class LeaveTypeCreate(BaseModel):
    name: str
    code: str
    max_days_per_year: float = 12
    is_paid: bool = True
    carry_forward: bool = False
    carry_forward_max: float = 0

class LeaveTypeUpdate(BaseModel):
    name: Optional[str] = None
    max_days_per_year: Optional[float] = None
    is_paid: Optional[bool] = None
    carry_forward: Optional[bool] = None
    carry_forward_max: Optional[float] = None
    is_active: Optional[bool] = None

# ── Leave Request Schemas ───────────────────────────────────────────────────
class LeaveApply(BaseModel):
    employee_id: int
    leave_type_id: int
    from_date: date
    to_date: date
    is_half_day: bool = False
    half_day_session: Optional[str] = None
    reason: Optional[str] = None

class LeaveAction(BaseModel):
    remarks: Optional[str] = None

class AllocateBalance(BaseModel):
    employee_ids: List[int]
    leave_type_id: int
    year: int
    allocated_days: float

# ── Helpers ─────────────────────────────────────────────────────────────────
def _next_leave_ref(db: Session):
    count = db.query(HRLeaveRequest).count() + 1
    return f"LV{str(count).zfill(5)}"

def _working_days_count(from_date: date, to_date: date) -> float:
    """Count calendar days (excluding Sundays) — can be customized per shift"""
    total = 0
    current = from_date
    while current <= to_date:
        if current.weekday() != 6:  # skip Sundays
            total += 1
        current += timedelta(days=1)
    return total

def _notify(db: Session, user_id: int, title: str, message: str, ref_type: str = None, ref_id: int = None):
    notif = HRNotification(user_id=user_id, title=title, message=message,
                           reference_type=ref_type, reference_id=ref_id)
    db.add(notif)
    try:
        send_push_to_user(user_id, title, message, ref_type, ref_id, db)
    except Exception as e:
        print(f"Failed to send push: {e}")


def _recompute_attendance(db: Session, employee_id: int, target_date: date, leave_request_id: int = None):
    """Mark attendance record as 'leave' when leave is approved"""
    record = db.query(HRAttendanceRecord).filter(
        HRAttendanceRecord.employee_id == employee_id,
        HRAttendanceRecord.date == target_date
    ).first()
    if not record:
        record = HRAttendanceRecord(employee_id=employee_id, date=target_date)
        db.add(record)
    record.status = "leave"
    if leave_request_id:
        record.leave_request_id = leave_request_id
    record.updated_at = datetime.utcnow()

# ── Leave Type Routes ────────────────────────────────────────────────────────
@router.get("/types")
def list_leave_types(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    types = db.query(HRLeaveType).all()
    return [{"id": t.id, "name": t.name, "code": t.code,
             "max_days_per_year": t.max_days_per_year, "is_paid": t.is_paid,
             "carry_forward": t.carry_forward, "carry_forward_max": t.carry_forward_max,
             "is_active": t.is_active} for t in types]

@router.post("/types")
def create_leave_type(data: LeaveTypeCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    if db.query(HRLeaveType).filter(HRLeaveType.code == data.code).first():
        raise HTTPException(400, "Leave type code already exists")
    lt = HRLeaveType(**data.model_dump())
    db.add(lt); db.commit(); db.refresh(lt)
    return {"id": lt.id, "name": lt.name, "code": lt.code}

@router.put("/types/{type_id}")
def update_leave_type(type_id: int, data: LeaveTypeUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    lt = db.query(HRLeaveType).filter(HRLeaveType.id == type_id).first()
    if not lt: raise HTTPException(404, "Not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(lt, k, v)
    db.commit(); db.refresh(lt)
    return {"id": lt.id, "name": lt.name}

@router.delete("/types/{type_id}")
def delete_leave_type(type_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    lt = db.query(HRLeaveType).filter(HRLeaveType.id == type_id).first()
    if not lt: raise HTTPException(404, "Not found")
    lt.is_active = False
    db.commit()
    return {"message": "Deactivated"}

# ── Leave Balance Routes ─────────────────────────────────────────────────────
@router.get("/balances")
def get_balances(
    employee_id: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.auth import is_hr_admin
    if not is_hr_admin(current_user, db):
        from app.auth import get_current_employee_optional
        emp = get_current_employee_optional(current_user, db)
        if not emp:
            return []
        if employee_id and employee_id != emp.id:
            raise HTTPException(status_code=403, detail="Access denied. You can only view your own balance.")
        employee_id = emp.id

    year = year or datetime.now().year
    q = db.query(HRLeaveBalance).filter(HRLeaveBalance.year == year)
    if employee_id:
        q = q.filter(HRLeaveBalance.employee_id == employee_id)
    balances = q.all()
    return [{
        "id": b.id, "employee_id": b.employee_id,
        "employee_name": b.employee.name if b.employee else None,
        "leave_type_id": b.leave_type_id,
        "leave_type_name": b.leave_type.name if b.leave_type else None,
        "leave_type_code": b.leave_type.code if b.leave_type else None,
        "year": b.year,
        "allocated_days": b.allocated_days,
        "used_days": b.used_days,
        "remaining_days": b.allocated_days - b.used_days,
        "monthly_limit": b.monthly_limit or 0.0,
    } for b in balances]

@router.post("/allocate")
def allocate_balances(data: AllocateBalance, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    created, updated = 0, 0
    for emp_id in data.employee_ids:
        existing = db.query(HRLeaveBalance).filter(
            HRLeaveBalance.employee_id == emp_id,
            HRLeaveBalance.leave_type_id == data.leave_type_id,
            HRLeaveBalance.year == data.year
        ).first()
        if existing:
            existing.allocated_days = data.allocated_days
            updated += 1
        else:
            b = HRLeaveBalance(employee_id=emp_id, leave_type_id=data.leave_type_id,
                               year=data.year, allocated_days=data.allocated_days)
            db.add(b)
            created += 1
    db.commit()
    return {"created": created, "updated": updated}

class SingleBalanceUpdate(BaseModel):
    leave_type_id: int
    allocated_days: float
    monthly_limit: Optional[float] = 0.0

@router.post("/balances/{employee_id}")
def update_employee_balances(employee_id: int, data: List[SingleBalanceUpdate], db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    year = datetime.now().year
    for item in data:
        existing = db.query(HRLeaveBalance).filter(
            HRLeaveBalance.employee_id == employee_id,
            HRLeaveBalance.leave_type_id == item.leave_type_id,
            HRLeaveBalance.year == year
        ).first()
        if existing:
            existing.allocated_days = item.allocated_days
            existing.monthly_limit = item.monthly_limit or 0.0
        else:
            b = HRLeaveBalance(employee_id=employee_id, leave_type_id=item.leave_type_id,
                               year=year, allocated_days=item.allocated_days,
                               monthly_limit=item.monthly_limit or 0.0)
            db.add(b)
    db.commit()
    return {"message": "Balances updated"}

# ── Leave Application Routes ─────────────────────────────────────────────────
@router.post("/apply")
def apply_leave(data: LeaveApply, background_tasks: BackgroundTasks, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    origin = request.headers.get("origin")
    if not origin:
        referer = request.headers.get("referer")
        if referer:
            from urllib.parse import urlparse
            parsed = urlparse(referer)
            origin = f"{parsed.scheme}://{parsed.netloc}"

    from app.auth import is_hr_admin
    if not is_hr_admin(current_user, db):
        from app.auth import get_current_employee
        emp_resolved = get_current_employee(current_user, db)
        if data.employee_id != emp_resolved.id:
            raise HTTPException(status_code=403, detail="Access denied. You can only apply leave for yourself.")

    emp = db.query(HREmployee).filter(HREmployee.id == data.employee_id).first()
    if not emp: raise HTTPException(404, "Employee not found")

    leave_type = db.query(HRLeaveType).filter(HRLeaveType.id == data.leave_type_id).first()
    if not leave_type: raise HTTPException(404, "Leave type not found")

    total_days = 0.5 if data.is_half_day else _working_days_count(data.from_date, data.to_date)

    # Check balance (skip for LOP)
    if leave_type.code != "LOP" and leave_type.is_paid:
        year = data.from_date.year
        balance = db.query(HRLeaveBalance).filter(
            HRLeaveBalance.employee_id == data.employee_id,
            HRLeaveBalance.leave_type_id == data.leave_type_id,
            HRLeaveBalance.year == year
        ).first()
        available = (balance.allocated_days - balance.used_days) if balance else 0.0
        
        if available < total_days:
            lop_overflow = get_hr_config(db, "lop_overflow", True)
            if not lop_overflow:
                raise HTTPException(400, f"Insufficient {leave_type.name} balance. Available: {available} days")
            
            # Auto-split!
            paid_days = max(0.0, available)
            unpaid_days = total_days - paid_days
            
            if paid_days == 0:
                lop_type = db.query(HRLeaveType).filter(HRLeaveType.code == "LOP").first()
                if not lop_type:
                    raise HTTPException(400, "LOP leave type not configured in master.")
                leave_type = lop_type
                data.leave_type_id = lop_type.id
                # Proceeds to save a full LOP request
            else:
                # Split dates precisely skipping Sundays (weekday == 6)
                current = data.from_date
                days_counted = 0.0
                while days_counted < paid_days:
                    if current.weekday() != 6:
                        if data.is_half_day:
                            days_counted += 0.5
                        else:
                            days_counted += 1.0
                    if days_counted == paid_days:
                        break
                    current += timedelta(days=1)
                
                paid_to_date = current
                unpaid_from_date = paid_to_date + timedelta(days=1)
                while unpaid_from_date.weekday() == 6:
                    unpaid_from_date += timedelta(days=1)
                
                lop_type = db.query(HRLeaveType).filter(HRLeaveType.code == "LOP").first()
                if not lop_type:
                    raise HTTPException(400, "LOP leave type not configured in master.")
                
                auto_approve_hours = get_hr_config(db, "leave_auto_approve_hours", 6)
                auto_approve_at = datetime.utcnow() + timedelta(hours=float(auto_approve_hours))
                ref_paid = _next_leave_ref(db)
                req_paid = HRLeaveRequest(
                    reference=ref_paid,
                    employee_id=data.employee_id,
                    leave_type_id=data.leave_type_id,
                    from_date=data.from_date,
                    to_date=paid_to_date,
                    total_days=paid_days,
                    is_half_day=data.is_half_day,
                    half_day_session=data.half_day_session,
                    reason=data.reason,
                    approver_id=emp.manager_id,
                    l1_approver_id=emp.manager_id,
                    l2_approver_id=getattr(emp, 'manager_l2_id', None),
                    auto_approve_at=auto_approve_at,
                )
                db.add(req_paid)
                db.flush()
                
                ref_unpaid = _next_leave_ref(db)
                req_unpaid = HRLeaveRequest(
                    reference=ref_unpaid,
                    employee_id=data.employee_id,
                    leave_type_id=lop_type.id,
                    from_date=unpaid_from_date,
                    to_date=data.to_date,
                    total_days=unpaid_days,
                    is_half_day=data.is_half_day,
                    half_day_session=data.half_day_session,
                    reason=f"{data.reason or ''} (Overflow from {leave_type.code})".strip(),
                    approver_id=emp.manager_id,
                    l1_approver_id=emp.manager_id,
                    l2_approver_id=getattr(emp, 'manager_l2_id', None),
                    auto_approve_at=auto_approve_at,
                )
                db.add(req_unpaid)
                
                if emp.manager_id:
                    manager = db.query(HREmployee).filter(HREmployee.id == emp.manager_id).first()
                    if manager and manager.user_id:
                        _notify(db, manager.user_id,
                                "Leave Split Submitted",
                                f"{emp.name} requested leave which was split: {paid_days}d of {leave_type.name} and {unpaid_days}d of LOP.",
                                "leave", req_paid.id)
                db.commit()
                background_tasks.add_task(_send_leave_email_notification, req_paid.id, True, origin)
                return {
                    "id": req_paid.id,
                    "reference": req_paid.reference,
                    "status": "pending",
                    "message": f"Applied successfully. Split into {paid_days} days of {leave_type.name} (Paid) and {unpaid_days} days of LOP (Unpaid) due to insufficient balance."
                }

    # Normal single request creation
    auto_approve_hours = get_hr_config(db, "leave_auto_approve_hours", 6)
    auto_approve_at = datetime.utcnow() + timedelta(hours=float(auto_approve_hours))
    req = HRLeaveRequest(
        reference=_next_leave_ref(db),
        employee_id=data.employee_id,
        leave_type_id=data.leave_type_id,
        from_date=data.from_date,
        to_date=data.to_date,
        total_days=total_days,
        is_half_day=data.is_half_day,
        half_day_session=data.half_day_session,
        reason=data.reason,
        approver_id=emp.manager_id,
        l1_approver_id=emp.manager_id,
        l2_approver_id=getattr(emp, 'manager_l2_id', None),
        auto_approve_at=auto_approve_at,
    )
    db.add(req); db.commit(); db.refresh(req)

    # Notify manager (in-app + email)
    if emp.manager_id:
        manager = db.query(HREmployee).filter(HREmployee.id == emp.manager_id).first()
        if manager and manager.user_id:
            _notify(db, manager.user_id,
                    "Leave Request Pending",
                    f"{emp.name} has applied for {leave_type.name} from {data.from_date} to {data.to_date}.",
                    "leave", req.id)
    db.commit()
    background_tasks.add_task(_send_leave_email_notification, req.id, True, origin)
    return {"id": req.id, "reference": req.reference, "status": req.status, "auto_approve_at": auto_approve_at.isoformat() + "Z"}

@router.get("/my-requests")
def my_requests(
    employee_id: int,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.auth import is_hr_admin
    if not is_hr_admin(current_user, db):
        from app.auth import get_current_employee_optional
        emp = get_current_employee_optional(current_user, db)
        if not emp:
            return []
        if employee_id != emp.id:
            raise HTTPException(status_code=403, detail="Access denied. You can only view your own requests.")
        employee_id = emp.id

    q = db.query(HRLeaveRequest).filter(HRLeaveRequest.employee_id == employee_id)
    if status:
        q = q.filter(HRLeaveRequest.status == status)
    reqs = q.order_by(HRLeaveRequest.created_at.desc()).all()
    return [_serialize_request(r) for r in reqs]

@router.get("/pending")
def pending_approvals(
    approver_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.auth import is_hr_admin
    if not is_hr_admin(current_user, db):
        from app.auth import get_current_employee_optional
        emp = get_current_employee_optional(current_user, db)
        if not emp:
            return []
        if approver_id and approver_id != emp.id:
            raise HTTPException(status_code=403, detail="Access denied. You can only view your own pending approvals.")
        reqs = db.query(HRLeaveRequest).filter(
            HRLeaveRequest.approver_id == emp.id,
            HRLeaveRequest.status == "pending"
        ).order_by(HRLeaveRequest.created_at).all()
    else:
        if approver_id is None:
            # Superadmin with no filter — return ALL pending
            reqs = db.query(HRLeaveRequest).filter(
                HRLeaveRequest.status == "pending"
            ).order_by(HRLeaveRequest.created_at).all()
        else:
            reqs = db.query(HRLeaveRequest).filter(
                (HRLeaveRequest.approver_id == approver_id) | (HRLeaveRequest.approver_id == None),
                HRLeaveRequest.status == "pending"
            ).order_by(HRLeaveRequest.created_at).all()
    return [_serialize_request(r) for r in reqs]

def _send_leave_email_notification(req_id: int, to_manager: bool = False, origin: Optional[str] = None):
    db = SessionLocal()
    try:
        req = db.query(HRLeaveRequest).filter(HRLeaveRequest.id == req_id).first()
        if not req or not req.employee:
            return
        from app.utils.email_service import send_template_email

        # ── Email to EMPLOYEE on status update (approve / reject) ──
        if not to_manager:
            if not req.employee.email or "@" not in req.employee.email:
                return
            variables = {
                "employee_name": req.employee.name,
                "leave_type": req.leave_type.name if req.leave_type else "Leave",
                "from_date": str(req.from_date),
                "to_date": str(req.to_date),
                "status": req.status,
                "approver_name": req.approver.name if req.approver else "HR/Manager",
                "reason": req.approver_remarks or "No remarks provided"
            }
            send_template_email(
                db=db,
                to_email=req.employee.email,
                template_name="leave_status_update",
                variables=variables
            )

        # ── Email to MANAGER on new application ──
        else:
            manager = db.query(HREmployee).filter(HREmployee.id == req.l1_approver_id).first() if req.l1_approver_id else None
            if not manager or not manager.email or "@" not in manager.email:
                return
            import os
            frontend_url = os.getenv("FRONTEND_URL", "").rstrip("/")
            if not frontend_url and origin:
                frontend_url = origin.rstrip("/")
            if not frontend_url:
                frontend_url = "http://localhost"
            action_url = f"{frontend_url}/hr/approvals?type=leave&id={req.id}"
            variables = {
                "employee_name": req.employee.name,
                "leave_type": req.leave_type.name if req.leave_type else "Leave",
                "from_date": str(req.from_date),
                "to_date": str(req.to_date),
                "total_days": str(req.total_days),
                "reason": req.reason or "No reason provided",
                "approver_name": manager.name,
                "action_url": action_url,
            }
            send_template_email(
                db=db,
                to_email=manager.email,
                template_name="leave_new_request",
                variables=variables
            )
    except Exception as e:
        print(f"⚠️ Failed to send leave email for req {req_id}: {e}")
    finally:
        db.close()

@router.get("/all")
def all_requests(
    status: Optional[str] = None,
    employee_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(HRLeaveRequest)
    if status: q = q.filter(HRLeaveRequest.status == status)
    if employee_id: q = q.filter(HRLeaveRequest.employee_id == employee_id)
    return [_serialize_request(r) for r in q.order_by(HRLeaveRequest.created_at.desc()).all()]

@router.post("/{req_id}/approve")
def approve_leave(req_id: int, data: LeaveAction, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    req = db.query(HRLeaveRequest).filter(HRLeaveRequest.id == req_id).first()
    if not req: raise HTTPException(404, "Request not found")
    from app.auth import is_hr_admin
    if not is_hr_admin(current_user, db):
        from app.auth import get_current_employee
        emp = get_current_employee(current_user, db)
        if req.approver_id != emp.id:
            raise HTTPException(status_code=403, detail="Access denied. You are not authorized to approve this request.")
    if req.status != "pending": raise HTTPException(400, f"Request is already {req.status}")

    # Role check
    emp = None
    if not is_hr_admin(current_user, db):
        from app.auth import get_current_employee
        emp = get_current_employee(current_user, db)

    is_l1 = (req.l1_approver_id == emp.id) if emp else False
    is_l2 = (req.l2_approver_id == emp.id) if emp else False
    is_super = is_hr_admin(current_user, db)

    final_approval = False

    if is_l1 and not is_l2 and req.l1_status == "pending":
        req.l1_status = "approved"
        req.l1_remarks = data.remarks
        req.l1_approved_at = datetime.utcnow()
        if req.l2_approver_id:
            req.approver_id = req.l2_approver_id
            # Notify L2 Manager
            l2_manager = db.query(HREmployee).filter(HREmployee.id == req.l2_approver_id).first()
            if l2_manager and l2_manager.user_id:
                _notify(db, l2_manager.user_id,
                        "Leave Request Pending (L2)",
                        f"{req.employee.name if req.employee else 'Employee'} leave approved by L1. Pending your final approval.",
                        "leave", req.id)
            db.commit()
            return {"message": "Approved (L1), pending L2", "id": req.id}
        else:
            final_approval = True
    elif is_l2 and (req.l2_status == "pending" or not req.l2_status):
        req.l2_status = "approved"
        req.l2_remarks = data.remarks
        req.l2_approved_at = datetime.utcnow()
        final_approval = True
    elif is_super:
        final_approval = True
    else:
        raise HTTPException(400, "You cannot approve this request in its current state.")

    if final_approval:
        req.status = "approved"
        req.approver_remarks = data.remarks
        req.approved_at = datetime.utcnow()

    # Deduct balance
    if req.leave_type and req.leave_type.code != "LOP":
        balance = db.query(HRLeaveBalance).filter(
            HRLeaveBalance.employee_id == req.employee_id,
            HRLeaveBalance.leave_type_id == req.leave_type_id,
            HRLeaveBalance.year == req.from_date.year
        ).first()
        if balance:
            balance.used_days += req.total_days

    # Update attendance records
    current_date = req.from_date
    while current_date <= req.to_date:
        _recompute_attendance(db, req.employee_id, current_date, req.id)
        current_date += timedelta(days=1)

    # Notify employee
    if req.employee and req.employee.user_id:
        _notify(db, req.employee.user_id,
                "Leave Approved ✓",
                f"Your {req.leave_type.name if req.leave_type else 'leave'} from {req.from_date} to {req.to_date} has been approved.",
                "leave", req.id)
    db.commit()
    background_tasks.add_task(_send_leave_email_notification, req.id)
    return {"message": "Approved", "id": req.id}

@router.post("/{req_id}/reject")
def reject_leave(req_id: int, data: LeaveAction, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    req = db.query(HRLeaveRequest).filter(HRLeaveRequest.id == req_id).first()
    if not req: raise HTTPException(404, "Request not found")
    from app.auth import is_hr_admin
    if not is_hr_admin(current_user, db):
        from app.auth import get_current_employee
        emp = get_current_employee(current_user, db)
        if req.approver_id != emp.id:
            raise HTTPException(status_code=403, detail="Access denied. You are not authorized to reject this request.")
    if req.status != "pending": raise HTTPException(400, f"Request is already {req.status}")
    
    emp = None
    if not is_hr_admin(current_user, db):
        from app.auth import get_current_employee
        emp = get_current_employee(current_user, db)

    is_l1 = (req.l1_approver_id == emp.id) if emp else False
    is_l2 = (req.l2_approver_id == emp.id) if emp else False
    
    if is_l1 and req.l1_status == "pending":
        req.l1_status = "rejected"
        req.l1_remarks = data.remarks
        req.l1_approved_at = datetime.utcnow()
    elif is_l2 and (req.l2_status == "pending" or not req.l2_status):
        req.l2_status = "rejected"
        req.l2_remarks = data.remarks
        req.l2_approved_at = datetime.utcnow()

    req.status = "rejected"
    req.approver_remarks = data.remarks
    req.approved_at = datetime.utcnow()
    if req.employee and req.employee.user_id:
        _notify(db, req.employee.user_id,
                "Leave Rejected ✗",
                f"Your leave from {req.from_date} to {req.to_date} was rejected. Reason: {data.remarks or 'No reason given'}",
                "leave", req.id)
    db.commit()
    background_tasks.add_task(_send_leave_email_notification, req.id)
    return {"message": "Rejected"}

@router.post("/{req_id}/cancel")
def cancel_leave(req_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    req = db.query(HRLeaveRequest).filter(HRLeaveRequest.id == req_id).first()
    if not req: raise HTTPException(404, "Request not found")
    from app.auth import is_hr_admin
    if not is_hr_admin(current_user, db):
        from app.auth import get_current_employee
        emp = get_current_employee(current_user, db)
        if req.employee_id != emp.id:
            raise HTTPException(status_code=403, detail="Access denied. You can only cancel your own requests.")
    if req.status != "pending": raise HTTPException(400, "Only pending requests can be cancelled")
    req.status = "cancelled"
    db.commit()
    return {"message": "Cancelled"}

def _serialize_request(r: HRLeaveRequest):
    remaining = None
    if r.auto_approve_at:
        diff = (r.auto_approve_at - datetime.utcnow()).total_seconds()
        remaining = max(0, int(diff))
    return {
        "id": r.id,
        "reference": r.reference,
        "employee_id": r.employee_id,
        "employee_name": r.employee.name if r.employee else None,
        "leave_type_id": r.leave_type_id,
        "leave_type_name": r.leave_type.name if r.leave_type else None,
        "leave_type_code": r.leave_type.code if r.leave_type else None,
        "from_date": str(r.from_date),
        "to_date": str(r.to_date),
        "total_days": r.total_days,
        "is_half_day": r.is_half_day,
        "half_day_session": r.half_day_session,
        "reason": r.reason,
        "status": r.status,
        "approver_id": r.approver_id,
        "approver_name": r.approver.name if r.approver else None,
        "approver_remarks": r.approver_remarks,
        "l1_approver_id": getattr(r, 'l1_approver_id', None),
        "l1_status": getattr(r, 'l1_status', None),
        "l2_approver_id": getattr(r, 'l2_approver_id', None),
        "l2_status": getattr(r, 'l2_status', None),
        "is_auto_approved": r.is_auto_approved,
        "auto_approve_at": r.auto_approve_at.isoformat() + "Z" if r.auto_approve_at else None,
        "seconds_until_auto_approve": remaining,
        "created_at": r.created_at.isoformat() + "Z" if r.created_at else None,
    }
