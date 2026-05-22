from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime, timedelta
from app.database import get_db
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
        "is_auto_approved": r.is_auto_approved,
        "auto_approve_at": str(r.auto_approve_at) if r.auto_approve_at else None,
        "seconds_until_auto_approve": remaining,
        "created_at": str(r.created_at),
    }

@router.post("/apply")
def apply_onduty(data: OnDutyApply, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_superadmin:
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
        auto_approve_at=auto_approve_at,
    )
    db.add(req); db.commit(); db.refresh(req)

    if emp.manager_id:
        manager = db.query(HREmployee).filter(HREmployee.id == emp.manager_id).first()
        if manager and manager.user_id:
            _notify(db, manager.user_id, "On-Duty Request Pending",
                    f"{emp.name} applied for On-Duty on {data.date} at {data.work_location}.",
                    "onduty", req.id)
    db.commit()
    return {"id": req.id, "reference": req.reference, "status": req.status}

@router.get("/my-requests")
def my_onduty_requests(employee_id: int, status: Optional[str] = None,
                       db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_superadmin:
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
def pending_onduty(approver_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_superadmin:
        from app.auth import get_current_employee_optional
        emp = get_current_employee_optional(current_user, db)
        if not emp:
            return []
        if approver_id != emp.id:
            raise HTTPException(status_code=403, detail="Access denied. You can only view your own pending approvals.")
        reqs = db.query(HROnDutyRequest).filter(
            HROnDutyRequest.approver_id == emp.id,
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
               db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    q = db.query(HROnDutyRequest)
    if status: q = q.filter(HROnDutyRequest.status == status)
    if employee_id: q = q.filter(HROnDutyRequest.employee_id == employee_id)
    return [_serialize(r) for r in q.order_by(HROnDutyRequest.created_at.desc()).all()]

@router.post("/{req_id}/approve")
def approve_onduty(req_id: int, data: OnDutyAction, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    req = db.query(HROnDutyRequest).filter(HROnDutyRequest.id == req_id).first()
    if not req: raise HTTPException(404, "Not found")
    if not current_user.is_superadmin:
        from app.auth import get_current_employee
        emp = get_current_employee(current_user, db)
        if req.approver_id != emp.id:
            raise HTTPException(status_code=403, detail="Access denied. You are not authorized to approve this request.")
    if req.status != "pending": raise HTTPException(400, f"Already {req.status}")
    req.status = "approved"
    req.approver_remarks = data.remarks
    req.approved_at = datetime.utcnow()

    # Update attendance record to on_duty
    record = db.query(HRAttendanceRecord).filter(
        HRAttendanceRecord.employee_id == req.employee_id,
        HRAttendanceRecord.date == req.date
    ).first()
    if not record:
        record = HRAttendanceRecord(employee_id=req.employee_id, date=req.date)
        db.add(record)
    record.status = "on_duty"
    record.onduty_request_id = req.id

    if req.employee and req.employee.user_id:
        _notify(db, req.employee.user_id, "On-Duty Approved ✓",
                f"Your On-Duty request for {req.date} has been approved.", "onduty", req.id)
    db.commit()
    return {"message": "Approved"}

@router.post("/{req_id}/reject")
def reject_onduty(req_id: int, data: OnDutyAction, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    req = db.query(HROnDutyRequest).filter(HROnDutyRequest.id == req_id).first()
    if not req: raise HTTPException(404, "Not found")
    if not current_user.is_superadmin:
        from app.auth import get_current_employee
        emp = get_current_employee(current_user, db)
        if req.approver_id != emp.id:
            raise HTTPException(status_code=403, detail="Access denied. You are not authorized to reject this request.")
    if req.status != "pending": raise HTTPException(400, f"Already {req.status}")
    req.status = "rejected"
    req.approver_remarks = data.remarks
    if req.employee and req.employee.user_id:
        _notify(db, req.employee.user_id, "On-Duty Rejected ✗",
                f"Your On-Duty for {req.date} was rejected. Reason: {data.remarks or 'No reason'}", "onduty", req.id)
    db.commit()
    return {"message": "Rejected"}
