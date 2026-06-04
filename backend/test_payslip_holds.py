"""
Quick test: check if pending holds are properly fetched and would appear in payslip.
Run from backend/ dir: python test_payslip_holds.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
os.chdir(os.path.dirname(__file__))

from app.database import SessionLocal
from app.hr_models import HRArrearRecord, HRPayrollRecord, HREmployee

db = SessionLocal()

print("=== Pending Held Arrears (ALL employees) ===")
holds = db.query(HRArrearRecord).filter(HRArrearRecord.status == "held").all()
for h in holds:
    emp = db.query(HREmployee).filter(HREmployee.id == h.employee_id).first()
    print(f"  Emp: {emp.name if emp else '?'} | Held: {h.held_month}/{h.held_year} | Amt: {h.amount_held} | Remarks: {h.remarks}")

print("\n=== Payroll Records (May 2026) ===")
recs = db.query(HRPayrollRecord).filter(HRPayrollRecord.month == 5, HRPayrollRecord.year == 2026).all()
for r in recs:
    emp = db.query(HREmployee).filter(HREmployee.id == r.employee_id).first()
    emp_holds = [h for h in holds if h.employee_id == r.employee_id]
    print(f"  {emp.name if emp else '?'} | Net: {r.net_salary} | Pending holds for this emp: {len(emp_holds)}")

print("\nDone.")
db.close()
