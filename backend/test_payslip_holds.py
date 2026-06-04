"""
Quick test: check if pending holds are properly fetched and would appear in payslip.
Run from backend/ dir: python test_payslip_holds.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
os.chdir(os.path.dirname(__file__))

from app.database import SessionLocal
import app.models
from app.hr_models import HRArrearRecord, HRPayrollRecord, HREmployee
from app.routers.hr_payroll import _generate_payslip_pdf_bytes

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
    
    if emp and "Nickendra" in emp.name:
        print("\n--- Generating Payslip PDF for Nickendra M ---")
        try:
            # Let's intercept the HTML generation or just check if _generate_payslip_pdf_bytes runs successfully
            pdf_bytes = _generate_payslip_pdf_bytes(r, db)
            print(f"  PDF Generated Successfully: {len(pdf_bytes)} bytes")
            
            # Let's manually generate HTML to print/verify contents
            from app.utils.pdf import generate_payslip_html
            from app.routers.hr_payroll import MONTH_NAMES
            
            # Re-fetch holds and leaves just like in hr_payroll.py
            all_pending_holds = db.query(HRArrearRecord).filter(
                HRArrearRecord.employee_id == emp.id,
                HRArrearRecord.status == "held"
            ).order_by(HRArrearRecord.held_year, HRArrearRecord.held_month).all()
            pending_holds = [
                {
                    "month": MONTH_NAMES[a.held_month] if 0 < a.held_month < 13 else "?",
                    "year": a.held_year,
                    "amount": float(a.amount_held or 0),
                    "remarks": a.remarks or ""
                }
                for a in all_pending_holds if float(a.amount_held or 0) > 0
            ]
            
            print(f"  Processed pending_holds: {pending_holds}")
            
            # Dummy config values just to run generate_payslip_html
            from app.models import FormDefinition
            payroll_template = db.query(FormDefinition).filter(
                FormDefinition.module == "payroll",
                FormDefinition.is_active == True
            ).order_by(FormDefinition.id.desc()).first()
            
            pdf_cfg = payroll_template.pdf_config if payroll_template else {}
            fields_config = payroll_template.fields_config if payroll_template else []
            
            html = generate_payslip_html(
                r, emp, MONTH_NAMES[5], 2026, pdf_cfg, fields_config,
                uan=emp.uan or "-", leave_summary=[], esi_number=emp.esi_number or "-",
                pending_holds=pending_holds
            )
            
            has_table = "Pending Salary Holds" in html
            print(f"  Does HTML contain 'Pending Salary Holds' text? {has_table}")
            
            # Save the html to a scratch file so the user can look at it
            scratch_path = "scratch_nickendra_payslip.html"
            with open(scratch_path, "w", encoding="utf-8") as f:
                f.write(html)
            print(f"  Saved HTML structure to {scratch_path}")
            
        except Exception as e:
            print(f"  Failed: {e}")

print("\nDone.")
db.close()
