from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime, timedelta
from app.database import get_db, SessionLocal
from app.models import User
from app.auth import get_current_user, require_admin
from app.hr_models import HROnDutyRequest, HREmployee, HRAttendanceRecord, HRNotification
from app.routers.hr_config import get_hr_config
from app.utils.push_service import send_push_to_user

router = APIRouter()

class OnDutyApply(BaseModel):
    employee_id: int
    date: date
    from_time: str
    to_time: str
    work_location: Optional[str] = None
    purpose: Optional[str] = None

class OnDutyAction(BaseModel):
    remarks: Optional[str] = None

def _next_od_ref(db):
    count = db.query(HROnDutyRequest).count() + 1
    return f"OD{str(count).zfill(5)}"

def _notify(db, user_id, title, message, ref_type=None, ref_id=None):
    notif = HRNotification(user_id=user_id, title=title, message=message,
                           reference_type=ref_type, reference_id=ref_id)
    db.add(notif)
    try:
        send_push_to_user(user_id, title, message, ref_type, ref_id, db)
    except Exception as e:
        print(f"Failed to send push: {e}")


def _serialize(r: HROnDutyRequest):
    remaining = None
    if r.auto_approve_at:
        diff = (r.auto_approve_at - datetime.utcnow()).total_seconds()
        remaining = max(0, int(diff))
    return {
        "id": r.id, "reference": r.reference,
        "employee_id": r.employee_id,
        "employee_name": r.employee.name if r.employee else None,
        "date": str(r.date),
        "from_time": r.from_time, "to_time": r.to_time,
        "work_location": r.work_location, "purpose": r.purpose,
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

@router.post("/apply")
def apply_onduty(data: OnDutyApply, background_tasks: BackgroundTasks, request: Request,
                 db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
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
            raise HTTPException(status_code=403, detail="Access denied. You can only apply On-Duty for yourself.")

    emp = db.query(HREmployee).filter(HREmployee.id == data.employee_id).first()
    if not emp: raise HTTPException(404, "Employee not found")

    auto_approve_hours = get_hr_config(db, "leave_auto_approve_hours", 6)
    auto_approve_at = datetime.utcnow() + timedelta(hours=float(auto_approve_hours))
    req = HROnDutyRequest(
        reference=_next_od_ref(db),
        employee_id=data.employee_id,
        date=data.date,
        from_time=data.from_time,
        to_time=data.to_time,
        work_location=data.work_location,
        purpose=data.purpose,
        approver_id=emp.manager_id,
        l1_approver_id=emp.manager_id,
        l2_approver_id=getattr(emp, 'manager_l2_id', None),
        auto_approve_at=auto_approve_at,
    )
    db.add(req); db.commit(); db.refresh(req)

    if emp.manager_id:
        manager = db.query(HREmployee).filter(HREmployee.id == emp.manager_id).first()
        if manager and manager.user_id:
            _notify(db, manager.user_id, "On-Duty Request Pending",
                    f"{emp.name} applied for On-Duty on {data.date} at {data.work_location or 'N/A'}.",
                    "onduty", req.id)
    db.commit()
    background_tasks.add_task(_send_onduty_email_notification, req.id, True, origin)
    return {"id": req.id, "reference": req.reference, "status": req.status}

@router.get("/my-requests")
def my_onduty_requests(employee_id: int, status: Optional[str] = None,
                       db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.auth import is_hr_admin
    if not is_hr_admin(current_user, db):
        from app.auth import get_current_employee_optional
        emp = get_current_employee_optional(current_user, db)
        if not emp:
            return []
        if employee_id != emp.id:
            raise HTTPException(status_code=403, detail="Access denied. You can only view your own requests.")
        employee_id = emp.id

    q = db.query(HROnDutyRequest).filter(HROnDutyRequest.employee_id == employee_id)
    if status: q = q.filter(HROnDutyRequest.status == status)
    return [_serialize(r) for r in q.order_by(HROnDutyRequest.created_at.desc()).all()]

@router.get("/pending")
def pending_onduty(approver_id: Optional[int] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.auth import is_hr_admin
    if not is_hr_admin(current_user, db):
        from app.auth import get_current_employee_optional
        emp = get_current_employee_optional(current_user, db)
        if not emp:
            return []
        if approver_id and approver_id != emp.id:
            raise HTTPException(status_code=403, detail="Access denied. You can only view your own pending approvals.")
        reqs = db.query(HROnDutyRequest).filter(
            HROnDutyRequest.approver_id == emp.id,
            HROnDutyRequest.status == "pending"
        ).all()
    else:
        if approver_id is None:
            # Superadmin with no filter — return ALL pending
            reqs = db.query(HROnDutyRequest).filter(
                HROnDutyRequest.status == "pending"
            ).all()
        else:
            reqs = db.query(HROnDutyRequest).filter(
                (HROnDutyRequest.approver_id == approver_id) | (HROnDutyRequest.approver_id == None),
                HROnDutyRequest.status == "pending"
            ).all()
    return [_serialize(r) for r in reqs]

@router.get("/all")
def all_onduty(status: Optional[str] = None, employee_id: Optional[int] = None,
               db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(HROnDutyRequest)
    if status: q = q.filter(HROnDutyRequest.status == status)
    if employee_id: q = q.filter(HROnDutyRequest.employee_id == employee_id)
    return [_serialize(r) for r in q.order_by(HROnDutyRequest.created_at.desc()).all()]

def _send_onduty_email_notification(req_id: int, to_manager: bool = False, origin: Optional[str] = None):
    db = SessionLocal()
    try:
        req = db.query(HROnDutyRequest).filter(HROnDutyRequest.id == req_id).first()
        if not req or not req.employee:
            return
        from app.utils.email_service import send_template_email

        # ── Email to EMPLOYEE on status update (approve / reject) ──
        if not to_manager:
            if not req.employee.email or "@" not in req.employee.email:
                return
            variables = {
                "employee_name": req.employee.name,
                "date": str(req.date),
                "status": req.status,
                "approver_name": req.approver.name if req.approver else "HR/Manager",
                "reason": req.approver_remarks or "No remarks provided"
            }
            send_template_email(
                db=db,
                to_email=req.employee.email,
                template_name="onduty_status_update",
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
            action_url = f"{frontend_url}/hr/approvals?type=onduty&id={req.id}"
            variables = {
                "employee_name": req.employee.name,
                "date": str(req.date),
                "from_time": req.from_time,
                "to_time": req.to_time,
                "work_location": req.work_location or "N/A",
                "purpose": req.purpose or "Not specified",
                "approver_name": manager.name,
                "action_url": action_url,
            }
            send_template_email(
                db=db,
                to_email=manager.email,
                template_name="onduty_new_request",
                variables=variables
            )
    except Exception as e:
        print(f"⚠️ Failed to send On-Duty email for req {req_id}: {e}")
    finally:
        db.close()


@router.post("/{req_id}/approve")
def approve_onduty(req_id: int, data: OnDutyAction, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    req = db.query(HROnDutyRequest).filter(HROnDutyRequest.id == req_id).first()
    if not req: raise HTTPException(404, "Not found")
    from app.auth import is_hr_admin
    if not is_hr_admin(current_user, db):
        from app.auth import get_current_employee
        emp = get_current_employee(current_user, db)
        if req.approver_id != emp.id:
            raise HTTPException(status_code=403, detail="Access denied. You are not authorized to approve this request.")
    if req.status != "pending": raise HTTPException(400, f"Already {req.status}")

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
            l2_manager = db.query(HREmployee).filter(HREmployee.id == req.l2_approver_id).first()
            if l2_manager and l2_manager.user_id:
                _notify(db, l2_manager.user_id, "On-Duty Request Pending (L2)",
                        f"{req.employee.name if req.employee else 'Employee'} on-duty approved by L1. Pending your approval.", "onduty", req.id)
            db.commit()
            return {"message": "Approved (L1), pending L2"}
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

    db.commit()

    # Automatically compute and merge attendance (OD + Biometric punches)
    from app.routers.hr_attendance import compute_record
    compute_record(db, req.employee_id, req.date)

    if req.employee and req.employee.user_id:
        _notify(db, req.employee.user_id, "On-Duty Approved ✓",
                f"Your On-Duty request for {req.date} has been approved.", "onduty", req.id)
    db.commit()
    background_tasks.add_task(_send_onduty_email_notification, req.id)
    return {"message": "Approved"}

@router.post("/{req_id}/reject")
def reject_onduty(req_id: int, data: OnDutyAction, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    req = db.query(HROnDutyRequest).filter(HROnDutyRequest.id == req_id).first()
    if not req: raise HTTPException(404, "Not found")
    from app.auth import is_hr_admin
    if not is_hr_admin(current_user, db):
        from app.auth import get_current_employee
        emp = get_current_employee(current_user, db)
        if req.approver_id != emp.id:
            raise HTTPException(status_code=403, detail="Access denied. You are not authorized to reject this request.")
    if req.status != "pending": raise HTTPException(400, f"Already {req.status}")

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
    if req.employee and req.employee.user_id:
        _notify(db, req.employee.user_id, "On-Duty Rejected ✗",
                f"Your On-Duty for {req.date} was rejected. Reason: {data.remarks or 'No reason'}", "onduty", req.id)
    db.commit()
    background_tasks.add_task(_send_onduty_email_notification, req.id)
    return {"message": "Rejected"}
