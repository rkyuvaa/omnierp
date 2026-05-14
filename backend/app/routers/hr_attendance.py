from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime, timedelta
import os, shutil, uuid
from app.database import get_db
from app.models import User
from app.auth import get_current_user
from app.hr_models import (
    HRAttendancePunch, HRAttendanceRecord, HREmployee,
    HRShift, HRHoliday, HRLeaveRequest, HROnDutyRequest
)

router = APIRouter()

# ── Day-abbreviation map ─────────────────────────────────────────────────────
DAY_MAP = {0: "Mon", 1: "Tue", 2: "Wed", 3: "Thu", 4: "Fri", 5: "Sat", 6: "Sun"}

# ── Status colour map (for frontend) ─────────────────────────────────────────
STATUS_COLORS = {
    "present":    "#22c55e",
    "late":       "#f59e0b",
    "absent":     "#ef4444",
    "half_day":   "#f97316",
    "leave":      "#6366f1",
    "on_duty":    "#06b6d4",
    "holiday":    "#8b5cf6",
    "weekly_off": "#94a3b8",
}

class PunchManual(BaseModel):
    employee_id: int
    punch_time: datetime
    source: str = "manual"

class BulkPunch(BaseModel):
    biometric_id: str
    punch_time: datetime
    raw_uid: str

class BulkSync(BaseModel):
    machine_id: int
    punches: List[BulkPunch]

class AttendanceCorrect(BaseModel):
    employee_id: int
    date: date
    status: str
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    correction_reason: str

# ── Core: compute attendance status for one employee on one date ──────────────
def compute_record(db: Session, employee_id: int, target_date: date):
    emp = db.query(HREmployee).filter(HREmployee.id == employee_id).first()
    if not emp:
        return None

    # Check holiday
    holiday = db.query(HRHoliday).filter(
        HRHoliday.date == target_date,
        HRHoliday.is_active == True,
        (HRHoliday.branch_id == emp.branch_id) | (HRHoliday.branch_id == None)
    ).first()

    # Get or create record
    record = db.query(HRAttendanceRecord).filter(
        HRAttendanceRecord.employee_id == employee_id,
        HRAttendanceRecord.date == target_date
    ).first()
    if not record:
        record = HRAttendanceRecord(employee_id=employee_id, date=target_date)
        db.add(record)

    # Holiday
    if holiday:
        record.status = "holiday"
        db.commit()
        return record

    # Approved leave?
    leave_req = db.query(HRLeaveRequest).filter(
        HRLeaveRequest.employee_id == employee_id,
        HRLeaveRequest.from_date <= target_date,
        HRLeaveRequest.to_date >= target_date,
        HRLeaveRequest.status.in_(["approved", "auto_approved"])
    ).first()
    if leave_req:
        record.status = "leave"
        record.leave_request_id = leave_req.id
        db.commit()
        return record

    # Approved on-duty?
    od_req = db.query(HROnDutyRequest).filter(
        HROnDutyRequest.employee_id == employee_id,
        HROnDutyRequest.date == target_date,
        HROnDutyRequest.status.in_(["approved", "auto_approved"])
    ).first()
    if od_req:
        record.status = "on_duty"
        record.onduty_request_id = od_req.id
        db.commit()
        return record

    # Check weekly off
    shift = emp.shift
    if shift:
        day_abbr = DAY_MAP[target_date.weekday()]
        if day_abbr not in (shift.working_days or []):
            record.status = "weekly_off"
            db.commit()
            return record

    # Get punches for the day
    day_start = datetime.combine(target_date, datetime.min.time())
    day_end = datetime.combine(target_date, datetime.max.time())
    punches = db.query(HRAttendancePunch).filter(
        HRAttendancePunch.employee_id == employee_id,
        HRAttendancePunch.punch_time >= day_start,
        HRAttendancePunch.punch_time <= day_end
    ).order_by(HRAttendancePunch.punch_time).all()

    if not punches:
        record.status = "absent"
        record.check_in = None
        record.check_out = None
        record.hours_worked = 0
        db.commit()
        return record

    check_in = punches[0].punch_time
    check_out = punches[-1].punch_time if len(punches) > 1 else None
    record.check_in = check_in
    record.check_out = check_out
    record.check_in_photo = punches[0].photo_url
    record.check_in_location = punches[0].location_name

    hours_worked = 0
    if check_out and check_out != check_in:
        hours_worked = (check_out - check_in).total_seconds() / 3600
    record.hours_worked = round(hours_worked, 2)

    # Compare against shift
    if shift:
        shift_start_h, shift_start_m = map(int, shift.start_time.split(":"))
        shift_end_h, shift_end_m = map(int, shift.end_time.split(":"))
        shift_start_dt = datetime.combine(target_date, datetime.min.time().replace(hour=shift_start_h, minute=shift_start_m))
        shift_end_dt = datetime.combine(target_date, datetime.min.time().replace(hour=shift_end_h, minute=shift_end_m))
        shift_duration = (shift_end_dt - shift_start_dt).total_seconds() / 3600

        grace_dt = shift_start_dt + timedelta(minutes=shift.grace_minutes)
        is_late = check_in > grace_dt
        late_minutes = max(0, int((check_in - grace_dt).total_seconds() / 60)) if is_late else 0

        record.is_late = is_late
        record.late_minutes = late_minutes

        if hours_worked < shift.half_day_hours:
            record.status = "half_day"
        elif is_late:
            record.status = "late"
        else:
            record.status = "present"

        # Early departure
        if check_out and check_out < shift_end_dt:
            record.left_early = True
            record.early_by_minutes = int((shift_end_dt - check_out).total_seconds() / 60)
    else:
        record.status = "present"

    db.commit()
    return record

# ── Routes ────────────────────────────────────────────────────────────────────
@router.post("/punch/mobile")
async def mobile_punch(
    employee_id: int = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    location_name: str = Form(...),
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    emp = db.query(HREmployee).filter(HREmployee.id == employee_id).first()
    if not emp: raise HTTPException(404, "Employee not found")

    # Save photo
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    upload_dir = os.path.join(BASE_DIR, "static", "uploads", "attendance")
    os.makedirs(upload_dir, exist_ok=True)
    ext = os.path.splitext(photo.filename)[1] or ".jpg"
    filename = f"punch_{employee_id}_{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(upload_dir, filename)
    with open(filepath, "wb") as f:
        shutil.copyfileobj(photo.file, f)

    punch_time = datetime.utcnow()
    punch = HRAttendancePunch(
        employee_id=employee_id,
        punch_time=punch_time,
        source="mobile",
        photo_url=f"/api/uploads/attendance/{filename}",
        latitude=latitude,
        longitude=longitude,
        location_name=location_name,
    )
    db.add(punch); db.commit()

    # Recompute daily record
    compute_record(db, employee_id, punch_time.date())
    return {"message": "Punch recorded", "punch_time": str(punch_time), "location": location_name}

@router.post("/punch/manual")
def manual_punch(data: PunchManual, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    punch = HRAttendancePunch(
        employee_id=data.employee_id,
        punch_time=data.punch_time,
        source="manual",
    )
    db.add(punch); db.commit()
    compute_record(db, data.employee_id, data.punch_time.date())
    return {"message": "Manual punch recorded"}

@router.get("/today/{employee_id}")
def today_status(employee_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    today = datetime.utcnow().date()
    record = compute_record(db, employee_id, today)
    if not record:
        return {"status": "no_record"}
    return {
        "employee_id": employee_id,
        "date": str(today),
        "status": record.status,
        "check_in": str(record.check_in) if record.check_in else None,
        "check_out": str(record.check_out) if record.check_out else None,
        "hours_worked": record.hours_worked,
        "is_late": record.is_late,
        "late_minutes": record.late_minutes,
        "check_in_photo": record.check_in_photo,
        "check_in_location": record.check_in_location,
        "status_color": STATUS_COLORS.get(record.status, "#94a3b8"),
    }

@router.get("/records")
def get_records(
    month: int,
    year: int,
    employee_id: Optional[int] = None,
    branch_id: Optional[int] = None,
    department_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from sqlalchemy import extract
    q = db.query(HRAttendanceRecord).filter(
        extract('month', HRAttendanceRecord.date) == month,
        extract('year', HRAttendanceRecord.date) == year,
    )
    if employee_id:
        q = q.filter(HRAttendanceRecord.employee_id == employee_id)

    records = q.all()
    result = {}
    for r in records:
        key = str(r.employee_id)
        if key not in result:
            result[key] = {}
        result[key][str(r.date)] = {
            "status": r.status,
            "color": STATUS_COLORS.get(r.status, "#94a3b8"),
            "check_in": str(r.check_in) if r.check_in else None,
            "check_out": str(r.check_out) if r.check_out else None,
            "hours_worked": r.hours_worked,
            "is_late": r.is_late,
            "late_minutes": r.late_minutes,
        }
    return result

@router.post("/correct")
def correct_attendance(data: AttendanceCorrect, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    record = db.query(HRAttendanceRecord).filter(
        HRAttendanceRecord.employee_id == data.employee_id,
        HRAttendanceRecord.date == data.date
    ).first()
    if not record:
        record = HRAttendanceRecord(employee_id=data.employee_id, date=data.date)
        db.add(record)
    record.status = data.status
    record.check_in = data.check_in
    record.check_out = data.check_out
    record.correction_reason = data.correction_reason
    record.corrected_by = current_user.id
    if data.check_in and data.check_out:
        record.hours_worked = round((data.check_out - data.check_in).total_seconds() / 3600, 2)
    db.commit()
    return {"message": "Attendance corrected"}

@router.get("/punches/{employee_id}")
def get_punches(employee_id: int, target_date: date = None,
                db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(HRAttendancePunch).filter(HRAttendancePunch.employee_id == employee_id)
    if target_date:
        day_start = datetime.combine(target_date, datetime.min.time())
        day_end = datetime.combine(target_date, datetime.max.time())
        q = q.filter(HRAttendancePunch.punch_time.between(day_start, day_end))
    punches = q.order_by(HRAttendancePunch.punch_time).all()
    return [{
        "id": p.id, "punch_time": str(p.punch_time),
        "source": p.source, "photo_url": p.photo_url,
        "latitude": p.latitude, "longitude": p.longitude,
        "location_name": p.location_name,
    } for p in punches]

@router.post("/sync/bulk")
def bulk_sync(data: BulkSync, db: Session = Depends(get_db)):
    """Bulk upload punches from a local sync agent"""
    imported = 0
    skipped = 0
    recompute_dates = set() # (employee_id, date)
    
    for p in data.punches:
        # Find employee by biometric_id
        emp = db.query(HREmployee).filter(HREmployee.biometric_id == p.biometric_id).first()
        if not emp:
            skipped += 1
            continue
            
        # Check if punch exists
        exists = db.query(HRAttendancePunch).filter(
            HRAttendancePunch.employee_id == emp.id,
            HRAttendancePunch.punch_time == p.punch_time
        ).first()
        
        if exists:
            skipped += 1
            continue
            
        punch = HRAttendancePunch(
            employee_id=emp.id,
            punch_time=p.punch_time,
            source="biometric",
            machine_id=data.machine_id,
            raw_punch_uid=p.raw_uid
        )
        db.add(punch)
        recompute_dates.add((emp.id, p.punch_time.date()))
        imported += 1
        
    db.commit()
    
    # Recompute daily records for all affected employees and dates
    for emp_id, target_date in recompute_dates:
        compute_record(db, emp_id, target_date)
        
    return {"message": "Bulk sync complete", "imported": imported, "skipped": skipped}

