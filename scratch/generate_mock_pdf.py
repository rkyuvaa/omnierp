import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.utils.pdf import generate_payslip_html, render_to_pdf

class MockDepartment:
    name = "Engineering"

class MockEmployee:
    id = 1
    employee_id = "EMP-001"
    name = "Nickendra M"
    designation = "Senior Engineer"
    department = MockDepartment()
    uan = "1234567890"
    esi_number = "9876543210"

class MockPayrollRecord:
    id = 101
    month = 5
    year = 2026
    total_earnings = 70000.00
    total_deductions = 5417.00
    net_salary = 64583.00
    components_breakdown = {
        "earnings": {
            "Basic Salary": 40000.00,
            "House Rent Allowance": 15000.00,
            "Special Allowance": 15000.00
        },
        "deductions": {
            "Provident Fund": 1800.00,
            "Professional Tax": 200.00,
            "Salary Held (Arrears)": 3417.00
        },
        "employer_contributions": {
            "PF Contribution": 1800.00
        }
    }

pdf_cfg = {
    "logo": "",
    "primary_color": "#195402"
}
fields_config = []

pending_holds = [
    {"month": "February", "year": 2026, "amount": 40000.00, "remarks": "Feb-26 Salary HOld"},
    {"month": "March", "year": 2026, "amount": 40000.00, "remarks": "Mar-26 Salary Arrear"},
    {"month": "April", "year": 2026, "amount": 40000.00, "remarks": "April Salary Arrear"}
]

html = generate_payslip_html(
    MockPayrollRecord(),
    MockEmployee(),
    "May",
    2026,
    pdf_cfg,
    fields_config,
    uan="1234567890",
    leave_summary=[],
    esi_number="9876543210",
    pending_holds=pending_holds
)

pdf_bytes = render_to_pdf(html)
output_pdf_path = os.path.join("scratch", "mock_payslip.pdf")
os.makedirs("scratch", exist_ok=True)
with open(output_pdf_path, "wb") as f:
    f.write(pdf_bytes)

print(f"Generated PDF at: {output_pdf_path}")
