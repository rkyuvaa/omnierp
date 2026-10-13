from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from sqlalchemy.orm import Session
from sqlalchemy import extract, func
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from app.database import get_db, SessionLocal
from app.models import User
from app.auth import get_current_user
from app.hr_models import (
    HRPermissionRequest, HREmployee, HRLeaveBalance, HRLeaveType, HRNotification
)
from app.utils.push_service import send_push_to_user

router = APIRouter()

# ── Schemas ─────────────────────────────────────────────────────────────────
class PermissionApply(BaseModel):
    employee_id: int
    date: date
    session: str                     # "morning" or "evening"
    duration_hours: float = 1.0      # Exactly 1.0 hour maximum
    reason: Optional[str] = None
    cc_employee_ids: Optional[List[int]] = None

class PermissionAction(BaseModel):
    remarks: Optional[str] = None


# ── Helpers ─────────────────────────────────────────────────────────────────
def _next_perm_ref(db: Session) -> str:
    count = db.query(HRPermissionRequest).count() + 1
    return f"PRM{str(count).zfill(5)}"

def _notify(db: Session, user_id: int, title: str, message: str, ref_type: str = "permission", ref_id: int = None):
    notif = HRNotification(user_id=user_id, title=title, message=message,
                           reference_type=ref_type, reference_id=ref_id)
    db.add(notif)
    try:
        send_push_to_user(user_id, title, message, ref_type, ref_id, db)
    except Exception as e:
        print(f"Failed to send push: {e}")

def _serialize_permission(r: HRPermissionRequest) -> dict:
    return {
        "id": r.id,
        "reference": r.reference,
        "employee_id": r.employee_id,
        "employee_name": r.employee.name if r.employee else None,
        "date": str(r.date),
        "session": r.session,
        "duration_hours": r.duration_hours,
        "reason": r.reason,
        "status": r.status,
        "approver_id": r.approver_id,
        "approver_name": r.approver.name if r.approver else None,
        "approver_remarks": r.approver_remarks,
        "approved_at": r.approved_at.isoformat() + "Z" if r.approved_at else None,
        "cc_employee_ids": r.cc_employee_ids or [],
        "created_at": r.created_at.isoformat() + "Z" if r.created_at else None,
    }

def _get_monthly_allowance(db: Session, employee_id: int, target_year: int) -> float:
    """Retrieve monthly allowance in hours from HRLeaveBalance (code=PERM), defaulting to 3.0."""
    perm_type = db.query(HRLeaveType).filter(
        (HRLeaveType.code == "PERM") | (HRLeaveType.name.ilike("%permission%"))
    ).first()
    if perm_type:
        bal = db.query(HRLeaveBalance).filter(
            HRLeaveBalance.employee_id == employee_id,
            HRLeaveBalance.leave_type_id == perm_type.id,
            HRLeaveBalance.year == target_year
        ).first()
        if bal and bal.monthly_limit and bal.monthly_limit > 0:
            return float(bal.monthly_limit)
    return 3.0


# ── Routes ──────────────────────────────────────────────────────────────────
@router.get("/monthly-status")
def get_monthly_status(
    employee_id: int,
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns monthly permission allowance, active/pending usage, and remaining allowance."""
    now = datetime.now()
    m = month or now.month
    y = year or now.year

    allowance = _get_monthly_allowance(db, employee_id, y)

    # Approved hours
    approved_hours = db.query(func.coalesce(func.sum(HRPermissionRequest.duration_hours), 0.0)).filter(
        HRPermissionRequest.employee_id == employee_id,
        extract("year", HRPermissionRequest.date) == y,
        extract("month", HRPermissionRequest.date) == m,
        HRPermissionRequest.status == "approved"
    ).scalar()

    # Pending hours (count against allowance)
    pending_hours = db.query(func.coalesce(func.sum(HRPermissionRequest.duration_hours), 0.0)).filter(
        HRPermissionRequest.employee_id == employee_id,
        extract("year", HRPermissionRequest.date) == y,
        extract("month", HRPermissionRequest.date) == m,
        HRPermissionRequest.status == "pending"
    ).scalar()

    total_active = float(approved_hours) + float(pending_hours)
    remaining = max(0.0, allowance - total_active)

    return {
        "employee_id": employee_id,
        "month": m,
        "year": y,
        "monthly_limit": allowance,
        "approved_hours": float(approved_hours),
        "pending_hours": float(pending_hours),
        "total_active_hours": total_active,
        "remaining_hours": remaining,
    }


@router.post("/apply")
def apply_permission(
    data: PermissionApply,
    background_tasks: BackgroundTasks,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Apply for a permission request.
    Rules enforced:
      1. Duration: Exactly 1 hour maximum per request.
      2. Session: Must be 'morning' or 'evening'.
      3. Monthly allowance: Maximum 3 requests per employee per calendar month (or configured limit).
         Pending requests count against the limit.
      4. Reporting manager must approve (emp.manager_id).
    """
    from app.auth import is_hr_admin
    if not is_hr_admin(current_user, db):
        from app.auth import get_current_employee
        emp_resolved = get_current_employee(current_user, db)
        if data.employee_id != emp_resolved.id:
            raise HTTPException(status_code=403, detail="Access denied. You can only apply permission for yourself.")

    emp = db.query(HREmployee).filter(HREmployee.id == data.employee_id).first()
    if not emp:
        raise HTTPException(404, "Employee not found")

    # 1. Duration Validation (1 hour maximum per request)
    if data.duration_hours <= 0 or data.duration_hours > 1.0:
        raise HTTPException(400, "Permission duration must be exactly 1 hour maximum per request.")

    # 2. Session Validation (morning or evening)
    session_normalized = (data.session or "").strip().lower()
    if session_normalized not in ("morning", "evening"):
        raise HTTPException(400, "Session must be either 'morning' or 'evening'.")

    # 3. Monthly Allowance Validation (Pending & Approved count against limit)
    req_year = data.date.year
    req_month = data.date.month
    allowance = _get_monthly_allowance(db, data.employee_id, req_year)

    active_hours = db.query(func.coalesce(func.sum(HRPermissionRequest.duration_hours), 0.0)).filter(
        HRPermissionRequest.employee_id == data.employee_id,
        extract("year", HRPermissionRequest.date) == req_year,
        extract("month", HRPermissionRequest.date) == req_month,
        HRPermissionRequest.status.in_(["pending", "approved"])
    ).scalar()

    if float(active_hours) + data.duration_hours > allowance:
        month_name = data.date.strftime("%B %Y")
        raise HTTPException(
            400,
            f"Monthly permission allowance exceeded. Maximum {int(allowance)} permission requests (1 hour each) allowed per calendar month. "
            f"You currently have {int(active_hours)} active/pending requests in {month_name}."
        )

    # 4. Routing to Reporting Manager
    approver_id = emp.manager_id
    cc_ids = data.cc_employee_ids if data.cc_employee_ids is not None else (getattr(emp, "cc_manager_ids", []) or [])

    req = HRPermissionRequest(
        reference=_next_perm_ref(db),
        employee_id=data.employee_id,
        date=data.date,
        session=session_normalized,
        duration_hours=data.duration_hours,
        reason=data.reason,
        status="pending",
        approver_id=approver_id,
        cc_employee_ids=cc_ids,
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    # Notify Reporting Manager
    if approver_id:
        manager = db.query(HREmployee).filter(HREmployee.id == approver_id).first()
        if manager and manager.user_id:
            _notify(
                db,
                manager.user_id,
                "Permission Request Pending",
                f"{emp.name} requested 1 hour permission on {data.date} ({session_normalized.capitalize()} session).",
                "permission",
                req.id,
            )

    # Notify CC recipients
    if cc_ids:
        cc_emps = db.query(HREmployee).filter(HREmployee.id.in_(cc_ids)).all()
        for cc_emp in cc_emps:
            if cc_emp.user_id:
                _notify(
                    db,
                    cc_emp.user_id,
                    "Permission Request CC Notice",
                    f"{emp.name} requested permission on {data.date} ({session_normalized.capitalize()} session).",
                    "permission",
                    req.id,
                )

    db.commit()

    origin = request.headers.get("origin") or ""
    background_tasks.add_task(_send_permission_email, req.id, to_manager=True, origin=origin)

    return {
        "id": req.id,
        "reference": req.reference,
        "status": req.status,
        "message": f"Permission request submitted ({session_normalized.capitalize()} session, 1 hour).",
    }


@router.get("/my-requests")
def my_permissions(
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
            raise HTTPException(status_code=403, detail="Access denied. You can only view your own permissions.")
        employee_id = emp.id

    q = db.query(HRPermissionRequest).filter(HRPermissionRequest.employee_id == employee_id)
    if status:
        q = q.filter(HRPermissionRequest.status == status)
    reqs = q.order_by(HRPermissionRequest.created_at.desc()).all()
    return [_serialize_permission(r) for r in reqs]


@router.get("/pending")
def pending_permissions(
    approver_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Pending permissions assigned to the reporting manager (or all for HR Admin)."""
    from app.auth import is_hr_admin
    if not is_hr_admin(current_user, db):
        from app.auth import get_current_employee_optional
        emp = get_current_employee_optional(current_user, db)
        if not emp:
            return []
        if approver_id and approver_id != emp.id:
            raise HTTPException(status_code=403, detail="Access denied.")
        reqs = db.query(HRPermissionRequest).filter(
            HRPermissionRequest.approver_id == emp.id,
            HRPermissionRequest.status == "pending"
        ).order_by(HRPermissionRequest.created_at.asc()).all()
    else:
        if approver_id is None:
            reqs = db.query(HRPermissionRequest).filter(
                HRPermissionRequest.status == "pending"
            ).order_by(HRPermissionRequest.created_at.asc()).all()
        else:
            reqs = db.query(HRPermissionRequest).filter(
                (HRPermissionRequest.approver_id == approver_id) | (HRPermissionRequest.approver_id == None),
                HRPermissionRequest.status == "pending"
            ).order_by(HRPermissionRequest.created_at.asc()).all()

    return [_serialize_permission(r) for r in reqs]


@router.get("/all")
def all_permissions(
    status: Optional[str] = None,
    employee_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(HRPermissionRequest)
    if status:
        q = q.filter(HRPermissionRequest.status == status)
    if employee_id:
        q = q.filter(HRPermissionRequest.employee_id == employee_id)
    return [_serialize_permission(r) for r in q.order_by(HRPermissionRequest.created_at.desc()).all()]


@router.post("/{req_id}/approve")
def approve_permission(
    req_id: int,
    data: PermissionAction,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    req = db.query(HRPermissionRequest).filter(HRPermissionRequest.id == req_id).first()
    if not req:
        raise HTTPException(404, "Permission request not found")

    from app.auth import is_hr_admin
    if not is_hr_admin(current_user, db):
        from app.auth import get_current_employee
        emp = get_current_employee(current_user, db)
        if req.approver_id != emp.id:
            raise HTTPException(status_code=403, detail="Access denied. You are not authorized to approve this request.")

    if req.status != "pending":
        raise HTTPException(400, f"Request is already {req.status}")

    req.status = "approved"
    req.approver_remarks = data.remarks
    req.approved_at = datetime.utcnow()

    # Annual HRLeaveBalance tracking if balance record exists
    perm_type = db.query(HRLeaveType).filter(
        (HRLeaveType.code == "PERM") | (HRLeaveType.name.ilike("%permission%"))
    ).first()
    if perm_type:
        bal = db.query(HRLeaveBalance).filter(
            HRLeaveBalance.employee_id == req.employee_id,
            HRLeaveBalance.leave_type_id == perm_type.id,
            HRLeaveBalance.year == req.date.year
        ).first()
        if bal:
            bal.used_days = round((bal.used_days or 0.0) + req.duration_hours, 2)

    # NOTE: As instructed, we do NOT touch attendance records. Attendance remains intact.

    # Notify employee
    if req.employee and req.employee.user_id:
        _notify(
            db,
            req.employee.user_id,
            "Permission Approved ✓",
            f"Your permission request for {req.date} ({req.session.capitalize()} session) has been approved.",
            "permission",
            req.id,
        )

    db.commit()
    background_tasks.add_task(_send_permission_email, req.id, to_manager=False)
    return {"message": "Permission approved successfully", "id": req.id}


@router.post("/{req_id}/reject")
def reject_permission(
    req_id: int,
    data: PermissionAction,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    req = db.query(HRPermissionRequest).filter(HRPermissionRequest.id == req_id).first()
    if not req:
        raise HTTPException(404, "Permission request not found")

    from app.auth import is_hr_admin
    if not is_hr_admin(current_user, db):
        from app.auth import get_current_employee
        emp = get_current_employee(current_user, db)
        if req.approver_id != emp.id:
            raise HTTPException(status_code=403, detail="Access denied. You are not authorized to reject this request.")

    if req.status != "pending":
        raise HTTPException(400, f"Request is already {req.status}")

    req.status = "rejected"
    req.approver_remarks = data.remarks
    req.approved_at = datetime.utcnow()

    # Rejection does NOT consume allowance: the slot is automatically released!

    if req.employee and req.employee.user_id:
        _notify(
            db,
            req.employee.user_id,
            "Permission Rejected ✗",
            f"Your permission for {req.date} ({req.session.capitalize()} session) was rejected. Reason: {data.remarks or 'No reason provided'}",
            "permission",
            req.id,
        )

    db.commit()
    background_tasks.add_task(_send_permission_email, req.id, to_manager=False)
    return {"message": "Permission rejected"}


@router.post("/{req_id}/cancel")
def cancel_permission(
    req_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cancel a permission request. Releases the allowance back to the employee.
    Permitted for employees while request is pending (or by HR Admin).
    """
    req = db.query(HRPermissionRequest).filter(HRPermissionRequest.id == req_id).first()
    if not req:
        raise HTTPException(404, "Permission request not found")

    from app.auth import is_hr_admin
    if not is_hr_admin(current_user, db):
        from app.auth import get_current_employee
        emp = get_current_employee(current_user, db)
        if req.employee_id != emp.id:
            raise HTTPException(status_code=403, detail="Access denied. You can only cancel your own requests.")
        if req.status != "pending":
            raise HTTPException(400, "Only pending permission requests can be cancelled.")
    else:
        if req.status not in ("pending", "approved"):
            raise HTTPException(400, f"Cannot cancel request in status '{req.status}'.")

    old_status = req.status
    req.status = "cancelled"

    # If it was approved, refund used_days in HRLeaveBalance
    if old_status == "approved":
        perm_type = db.query(HRLeaveType).filter(
            (HRLeaveType.code == "PERM") | (HRLeaveType.name.ilike("%permission%"))
        ).first()
        if perm_type:
            bal = db.query(HRLeaveBalance).filter(
                HRLeaveBalance.employee_id == req.employee_id,
                HRLeaveBalance.leave_type_id == perm_type.id,
                HRLeaveBalance.year == req.date.year
            ).first()
            if bal:
                bal.used_days = max(0.0, (bal.used_days or 0.0) - req.duration_hours)

    db.commit()
    return {"message": "Permission request cancelled. Monthly allowance released."}


# ── Email Service Helper ────────────────────────────────────────────────────
def _send_permission_email(req_id: int, to_manager: bool = False, origin: str = ""):
    db = SessionLocal()
    try:
        req = db.query(HRPermissionRequest).filter(HRPermissionRequest.id == req_id).first()
        if not req or not req.employee:
            return
        from app.utils.email_service import send_template_email

        if not to_manager:
            if req.employee.email and "@" in req.employee.email:
                send_template_email(
                    db=db,
                    to_email=req.employee.email,
                    template_name="leave_status_update",
                    variables={
                        "employee_name": req.employee.name,
                        "leave_type": f"Permission ({req.session.capitalize()} Session, 1 hr)",
                        "from_date": str(req.date),
                        "to_date": str(req.date),
                        "status": req.status,
                        "approver_name": req.approver.name if req.approver else "Manager",
                        "reason": req.approver_remarks or "No remarks provided"
                    }
                )
        else:
            manager = db.query(HREmployee).filter(HREmployee.id == req.approver_id).first() if req.approver_id else None
            if manager and manager.email and "@" in manager.email:
                import os
                frontend_url = os.getenv("FRONTEND_URL", "").rstrip("/") or origin.rstrip("/") or "http://localhost"
                send_template_email(
                    db=db,
                    to_email=manager.email,
                    template_name="leave_new_request",
                    variables={
                        "employee_name": req.employee.name,
                        "leave_type": f"Permission ({req.session.capitalize()} Session, 1 hr)",
                        "from_date": str(req.date),
                        "to_date": str(req.date),
                        "total_days": "1 hour",
                        "reason": req.reason or "No reason provided",
                        "approver_name": manager.name,
                        "action_url": f"{frontend_url}/hr/approvals?type=permission&id={req.id}",
                    }
                )
    except Exception as e:
        print(f"⚠️ Failed to send permission email: {e}")
    finally:
        db.close()
