import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import all models to ensure mapper initialization succeeds
from app import models
from app.database import SessionLocal
from app.hr_models import HRAttendanceRecord, HRLeaveBalance, HRLeaveType
from app.routers.hr_attendance import _process_comp_off

db = SessionLocal()
try:
    # 1. Find CO leave type
    co_type = db.query(HRLeaveType).filter(HRLeaveType.code == "CO").first()
    if not co_type:
        print("Comp-Off leave type 'CO' not found.")
        sys.exit(0)
        
    # 2. Reset all CO leave balances to 0 allocated_days
    balances = db.query(HRLeaveBalance).filter(HRLeaveBalance.leave_type_id == co_type.id).all()
    for b in balances:
        b.allocated_days = 0.0
    db.commit()
    print(f"Reset {len(balances)} Comp-Off balances to 0.0")
    
    # 3. Fetch all attendance records and reset their comp_off_hours to 0
    records = db.query(HRAttendanceRecord).all()
    for r in records:
        r.comp_off_hours = 0.0
    db.commit()
    
    # 4. Re-process comp-off for all attendance records
    print("Re-calculating Comp-Off for all attendance records...")
    processed_count = 0
    for r in records:
        _process_comp_off(db, r)
        processed_count += 1
        
    db.commit()
    print(f"Successfully re-processed {processed_count} attendance records.")
    
    # Print the updated balances
    updated_balances = db.query(HRLeaveBalance).filter(HRLeaveBalance.leave_type_id == co_type.id).all()
    print("\nUpdated Balances:")
    for b in updated_balances:
        print(f"Employee ID: {b.employee_id}, Year: {b.year}, Allocated: {b.allocated_days} days")
except Exception as e:
    print("Error:", e)
finally:
    db.close()
