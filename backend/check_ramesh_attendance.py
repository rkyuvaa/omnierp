import os
import sys
from datetime import date

# Add current directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), ".")))

from app.database import SessionLocal
from app.hr_models import HRAttendanceRecord, HRAttendancePunch, HREmployee
from app.models import User

def check():
    db = SessionLocal()
    try:
        emp = db.query(HREmployee).filter(HREmployee.employee_id == "EMP-013").first()
        if not emp:
            print("Employee EMP-013 (Ramesh) not found!")
            return
            
        target_date = date(2026, 5, 26)
        rec = db.query(HRAttendanceRecord).filter(
            HRAttendanceRecord.employee_id == emp.id,
            HRAttendanceRecord.date == target_date
        ).first()
        
        if rec:
            print("Attendance Record for Ramesh Y on 2026-05-26:")
            print(f" - ID: {rec.id}")
            print(f" - Status: {rec.status}")
            print(f" - Check In: {rec.check_in}")
            print(f" - Check Out: {rec.check_out}")
            print(f" - Leave ID: {rec.leave_request_id}")
            print(f" - On-Duty ID: {rec.onduty_request_id}")
            print(f" - Corrected By: {rec.corrected_by}")
            print(f" - Correction Reason: {rec.correction_reason}")
        else:
            print("No daily attendance record found for Ramesh Y on 2026-05-26!")

        # Query raw punches
        from datetime import datetime
        day_start = datetime.combine(target_date, datetime.min.time())
        day_end = datetime.combine(target_date, datetime.max.time())
        punches = db.query(HRAttendancePunch).filter(
            HRAttendancePunch.employee_id == emp.id,
            HRAttendancePunch.punch_time >= day_start,
            HRAttendancePunch.punch_time <= day_end
        ).all()
        
        print(f"\nRaw punches found for Ramesh Y on 2026-05-26: {len(punches)}")
        for p in punches:
            print(f" - Punch Time: {p.punch_time} | Source: {p.source} | Location: {p.location_name}")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check()
