from app.database import SessionLocal
from app.hr_models import HRPayrollRecord, HREmployee

db = SessionLocal()
records = db.query(HRPayrollRecord).all()
print(f"Total payroll records: {len(records)}")

for r in records:
    emp = db.query(HREmployee).filter(HREmployee.id == r.employee_id).first()
    if not emp:
        print(f"Orphaned Record: ID={r.id}, EmployeeID={r.employee_id}, Month={r.month}/{r.year}")
    else:
        if not emp.name:
            print(f"Record with empty name: ID={r.id}, EmployeeID={r.employee_id}, Name='{emp.name}'")

db.close()
