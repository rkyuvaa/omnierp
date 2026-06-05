import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal
from app.hr_models import HREmployee, HRArrearRecord

db = SessionLocal()
try:
    employees = db.query(HREmployee).all()
    arrears = db.query(HRArrearRecord).all()
    
    with open("c:/Users/rkyuv/OneDrive/Documents/erp/backend/scratch/inspect_output.txt", "w", encoding="utf-8") as f:
        f.write(f"Total Employees: {len(employees)}\n")
        f.write(f"Total Arrears Records: {len(arrears)}\n\n")
        
        f.write("EMPLOYEES:\n")
        for emp in employees:
            f.write(f"ID: {emp.id}, Name: {emp.name}, Code: {emp.employee_id}, Active: {emp.is_active}\n")
            
        f.write("\nARREAR RECORDS:\n")
        for arr in arrears:
            f.write(f"ID: {arr.id}, Employee ID: {arr.employee_id}, Status: {arr.status}, Amount: {arr.amount_held}, Month/Year: {arr.held_month}/{arr.held_year}\n")
            
        # Let's run the exact query logic we just deployed:
        arrear_emp_ids = db.query(HRArrearRecord.employee_id).distinct().all()
        emp_ids = [r[0] for r in arrear_emp_ids if r[0] is not None]
        f.write(f"\nDistinct Employee IDs with arrears: {emp_ids}\n")
        
        employees_with_arrears = db.query(HREmployee).filter(HREmployee.id.in_(emp_ids)).all()
        f.write(f"Employees with arrears query result count: {len(employees_with_arrears)}\n")
        
        for emp in employees_with_arrears:
            emp_arrears = db.query(HRArrearRecord).filter(HRArrearRecord.employee_id == emp.id).all()
            total_pending = sum(float(a.amount_held or 0) for a in emp_arrears if a.status in ["held", "one_time"])
            f.write(f"- {emp.name} (Active: {emp.is_active}): total_pending = {total_pending}\n")

finally:
    db.close()
