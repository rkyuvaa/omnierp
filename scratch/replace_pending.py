import os

filepath = "backend/app/routers/hr_payroll.py"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

replacement = """@router.get("/arrears/pending-list")
def list_pending_arrears(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    import traceback
    try:
        # 1. Get all employees who have at least one arrear record
        employees_with_arrears = db.query(HREmployee).join(
            HRArrearRecord, HREmployee.id == HRArrearRecord.employee_id
        ).distinct().all()
        
        response_data = []
        for emp in employees_with_arrears:
            # 2. Get all arrear records for this employee
            arrears = db.query(HRArrearRecord).filter(HRArrearRecord.employee_id == emp.id).all()
            
            # Calculate pending amount (status in ['held', 'one_time'])
            total_pending = sum(float(a.amount_held or 0) for a in arrears if a.status in ["held", "one_time"])
            
            # Apply visibility rules:
            # - Show all active employees with arrear records
            # - Show inactive employees only when there is a pending arrear amount > 0
            if emp.is_active or total_pending > 0:
                response_data.append({
                    "employee_id": emp.id,
                    "name": emp.name,
                    "code": emp.employee_id,
                    "total_pending": round(total_pending, 2)
                })
                
        # Sort alphabetically by name
        response_data.sort(key=lambda x: (x["name"] or "").lower())
        return response_data
    except Exception as e:
        return {"error": str(e), "traceback": traceback.format_exc()}"""

# Normalize line endings
content_norm = content.replace("\r\n", "\n")
replacement_norm = replacement.replace("\r\n", "\n")

start_idx = content_norm.find('@router.get("/arrears/pending-list")')
if start_idx != -1:
    end_idx = content_norm.find('@router.get("/arrears/{employee_id}")', start_idx)
    if end_idx != -1:
        content_norm = content_norm[:start_idx] + replacement_norm + "\n\n" + content_norm[end_idx:]
        with open(filepath, "w", encoding="utf-8", newline="\n") as f:
            f.write(content_norm)
        print("Success")
    else:
        print("Could not find next route decorator")
else:
    print("Could not find route decorator")
