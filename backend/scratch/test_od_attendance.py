import sys
import os
from datetime import date, datetime, time

# Override DATABASE_URL for standalone sqlite testing
os.environ["DATABASE_URL"] = "sqlite:///./omnierp.db"

# Add backend root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, engine, Base
from app.hr_models import HREmployee, HRShift, HRAttendancePunch, HROnDutyRequest, HRAttendanceRecord
from app.routers.hr_attendance import compute_record

def run_tests():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        print("Running On-Duty Attendance Merging Unit Tests...")

        # 1. Setup Test Shift (09:00 to 18:00, grace 15m, half_day 4.0h)
        shift = db.query(HRShift).filter(HRShift.name == "OD_Test_Shift").first()
        if not shift:
            shift = HRShift(
                name="OD_Test_Shift",
                start_time="09:00",
                end_time="18:00",
                grace_minutes=15,
                half_day_hours=4.0,
                working_days=["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
            )
            db.add(shift)
            db.commit()
            db.refresh(shift)

        # 2. Setup Test Employee
        emp = db.query(HREmployee).filter(HREmployee.employee_id == "TEST_OD_001").first()
        if not emp:
            emp = HREmployee(
                employee_id="TEST_OD_001",
                name="OD Test Employee",
                shift_id=shift.id
            )
            db.add(emp)
            db.commit()
            db.refresh(emp)

        test_date_1 = date(2026, 7, 22)  # Morning OD test
        test_date_2 = date(2026, 7, 23)  # Evening OD test
        test_date_3 = date(2026, 7, 24)  # Mid-day OD test
        test_date_4 = date(2026, 7, 25)  # Full-day OD test

        # Cleanup existing test records
        for d in [test_date_1, test_date_2, test_date_3, test_date_4]:
            db.query(HRAttendancePunch).filter(HRAttendancePunch.employee_id == emp.id, HRAttendancePunch.punch_time >= datetime.combine(d, time.min), HRAttendancePunch.punch_time <= datetime.combine(d, time.max)).delete()
            db.query(HROnDutyRequest).filter(HROnDutyRequest.employee_id == emp.id, HROnDutyRequest.date == d).delete()
            db.query(HRAttendanceRecord).filter(HRAttendanceRecord.employee_id == emp.id, HRAttendanceRecord.date == d).delete()
        db.commit()

        # ── TEST 1: Morning OD (09:00 - 11:00) + Biometric IN (11:05) + Biometric OUT (18:00) ──
        print("\n--- Test 1: Morning OD ---")
        od1 = HROnDutyRequest(employee_id=emp.id, date=test_date_1, from_time="09:00", to_time="11:00", status="approved")
        db.add(od1)
        p1_in = HRAttendancePunch(employee_id=emp.id, punch_time=datetime(2026, 7, 22, 11, 5))
        p1_out = HRAttendancePunch(employee_id=emp.id, punch_time=datetime(2026, 7, 22, 18, 0))
        db.add_all([p1_in, p1_out])
        db.commit()

        rec1 = compute_record(db, emp.id, test_date_1)
        print(f"Status: {rec1.status} (Expected: present)")
        print(f"Is Late: {rec1.is_late} (Expected: False)")
        print(f"Late Minutes: {rec1.late_minutes} (Expected: 0)")
        print(f"Hours Worked: {rec1.hours_worked} (Expected: ~8.92)")
        assert rec1.status == "present", f"Fail: {rec1.status}"
        assert rec1.is_late == False, f"Fail: {rec1.is_late}"
        assert rec1.hours_worked >= 8.5, f"Fail hours: {rec1.hours_worked}"
        print("[SUCCESS] Test 1 Passed!")

        # ── TEST 2: Evening OD (15:00 - 18:00) + Biometric IN (09:00) + NO Biometric OUT ──
        print("\n--- Test 2: Evening OD ---")
        od2 = HROnDutyRequest(employee_id=emp.id, date=test_date_2, from_time="15:00", to_time="18:00", status="approved")
        db.add(od2)
        p2_in = HRAttendancePunch(employee_id=emp.id, punch_time=datetime(2026, 7, 23, 9, 0))
        db.add(p2_in)
        db.commit()

        rec2 = compute_record(db, emp.id, test_date_2)
        print(f"Status: {rec2.status} (Expected: present)")
        print(f"Left Early: {rec2.left_early} (Expected: False)")
        print(f"Hours Worked: {rec2.hours_worked} (Expected: 9.0)")
        assert rec2.status == "present", f"Fail: {rec2.status}"
        assert rec2.left_early == False, f"Fail: {rec2.left_early}"
        assert rec2.hours_worked == 9.0, f"Fail hours: {rec2.hours_worked}"
        print("[SUCCESS] Test 2 Passed!")

        # ── TEST 3: Mid-day OD (13:00 - 15:00) + Biometric IN (09:00) + Biometric OUT (18:00) ──
        print("\n--- Test 3: Mid-day OD ---")
        od3 = HROnDutyRequest(employee_id=emp.id, date=test_date_3, from_time="13:00", to_time="15:00", status="approved")
        db.add(od3)
        p3_in = HRAttendancePunch(employee_id=emp.id, punch_time=datetime(2026, 7, 24, 9, 0))
        p3_out = HRAttendancePunch(employee_id=emp.id, punch_time=datetime(2026, 7, 24, 18, 0))
        db.add_all([p3_in, p3_out])
        db.commit()

        rec3 = compute_record(db, emp.id, test_date_3)
        print(f"Status: {rec3.status} (Expected: present)")
        print(f"Hours Worked: {rec3.hours_worked} (Expected: 9.0)")
        assert rec3.status == "present", f"Fail: {rec3.status}"
        assert rec3.hours_worked == 9.0, f"Fail hours: {rec3.hours_worked}"
        print("[SUCCESS] Test 3 Passed!")

        # ── TEST 4: Full Day OD (09:00 - 18:00) + 0 Physical Punches ──
        print("\n--- Test 4: Full Day OD ---")
        od4 = HROnDutyRequest(employee_id=emp.id, date=test_date_4, from_time="09:00", to_time="18:00", status="approved")
        db.add(od4)
        db.commit()

        rec4 = compute_record(db, emp.id, test_date_4)
        print(f"Status: {rec4.status} (Expected: on_duty)")
        print(f"Hours Worked: {rec4.hours_worked} (Expected: 9.0)")
        assert rec4.status == "on_duty", f"Fail: {rec4.status}"
        assert rec4.hours_worked == 9.0, f"Fail hours: {rec4.hours_worked}"
        print("[SUCCESS] Test 4 Passed!")

        print("\n[PASSED] ALL ON-DUTY ATTENDANCE MERGING TESTS PASSED SUCCESSFULLY!")
    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
