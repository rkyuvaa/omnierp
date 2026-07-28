import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.database import SessionLocal
from app.models import HRConfig
from app.hr_models import HREmployee
from app.routers.hr_payroll import _calculate_payroll
import json

db = SessionLocal()

configs = db.query(HRConfig).all()
print("--- HR CONFIGS ---")
for c in configs:
    print(f"{c.config_key}: {c.config_value}")

print("\n--- TEST PAYROLL ---")
emp = db.query(HREmployee).filter(HREmployee.is_active == True).first()
if emp:
    print(f"Employee: {emp.name}, Basic: {emp.basic_salary}")
    res = _calculate_payroll(db, emp, 5, 2026, "net_pay")
    print(f"LOP Days: {res.get('lop_days')}")
    print(f"Earnings: {json.dumps(res.get('earnings'), indent=2)}")
    print(f"Deductions: {json.dumps(res.get('deductions'), indent=2)}")
    print(f"Net Salary: {res.get('net_salary')}")
