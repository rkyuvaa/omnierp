from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from fastapi.staticfiles import StaticFiles
import os
from app.routers import auth, users, branches, departments, roles, modules, crm, installation, installationlayout, service, studio, dashboard, audit, warranty, crm_layout, forms, konwertcare, issue_matrix, admin, admin_settings, tasks
from app.routers import hr_employees, hr_shifts, hr_holidays, hr_leave, hr_onduty, hr_attendance, hr_biometric, hr_reports, hr_payroll, hr_notifications, hr_salary_templates, hr_salary_components, hr_config, hr_push_subscriptions
from app.routers import bank
from app.routers import finance
from app.hr_models import *  # register HR models with Base
from app.bank_models import *  # register Bank models with Base
from app.hr_scheduler import start_scheduler


app = FastAPI(title="OmniERP API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# from patch_db import patch_db
# patch_db()

Base.metadata.create_all(bind=engine)

# Seed Email Templates
from app.database import SessionLocal
from app.routers.admin_settings import seed_email_templates
_db = SessionLocal()
try:
    seed_email_templates(_db)
    print("✅ Email templates seeded successfully")
except Exception as e:
    print(f"⚠️ Error seeding templates: {e}")
finally:
    _db.close()

# Auto-link Employees and User Accounts by email case-insensitively
from app.models import User
from app.hr_models import HREmployee
_db = SessionLocal()
try:
    unlinked_emps = _db.query(HREmployee).filter(HREmployee.user_id == None, HREmployee.email != None).all()
    if unlinked_emps:
        linked_count = 0
        for emp in unlinked_emps:
            # Match by case-insensitive email
            user = _db.query(User).filter(User.email.ilike(emp.email)).first()
            if user:
                emp.user_id = user.id
                linked_count += 1
        if linked_count > 0:
            _db.commit()
            print(f"✅ Auto-linked {linked_count} employees to user accounts by email case-insensitively")
except Exception as e:
    print(f"⚠️ Error auto-linking employees to user accounts: {e}")
finally:
    _db.close()

# Auto-migrate: add any missing columns safely
from sqlalchemy import text as _text, inspect as _inspect
def _safe_add_columns():
    """Add new columns to existing tables if they don't exist."""
    inspector = _inspect(engine)
    migrations = [
        # (table, column, sql_type)
        ("hr_salary_components", "apply_if_gross_below", "DOUBLE PRECISION"),
        ("hr_salary_components", "apply_if_gross_above", "DOUBLE PRECISION"),
        ("hr_payroll_records", "arrears_held", "DOUBLE PRECISION"),
        ("hr_payroll_records", "arrears_paid", "DOUBLE PRECISION"),
        ("branches", "latitude", "DOUBLE PRECISION"),
        ("branches", "longitude", "DOUBLE PRECISION"),
        ("branches", "radius", "DOUBLE PRECISION"),
        ("users", "totp_secret", "VARCHAR(100)"),
        ("users", "totp_enabled", "BOOLEAN DEFAULT FALSE"),
        ("hr_employees", "manager_l2_id", "INTEGER"),
        ("hr_leave_requests", "l1_approver_id", "INTEGER"),
        ("hr_leave_requests", "l1_status", "VARCHAR(20) DEFAULT 'pending'"),
        ("hr_leave_requests", "l1_remarks", "TEXT"),
        ("hr_leave_requests", "l1_approved_at", "TIMESTAMP"),
        ("hr_leave_requests", "l2_approver_id", "INTEGER"),
        ("hr_leave_requests", "l2_status", "VARCHAR(20)"),
        ("hr_leave_requests", "l2_remarks", "TEXT"),
        ("hr_leave_requests", "l2_approved_at", "TIMESTAMP"),
        ("hr_onduty_requests", "l1_approver_id", "INTEGER"),
        ("hr_onduty_requests", "l1_status", "VARCHAR(20) DEFAULT 'pending'"),
        ("hr_onduty_requests", "l1_remarks", "TEXT"),
        ("hr_onduty_requests", "l1_approved_at", "TIMESTAMP"),
        ("hr_onduty_requests", "l2_approver_id", "INTEGER"),
        ("hr_onduty_requests", "l2_status", "VARCHAR(20)"),
        ("hr_onduty_requests", "l2_remarks", "TEXT"),
        ("hr_onduty_requests", "l2_approved_at", "TIMESTAMP"),
        # Finance module new columns
        ("bank_transactions", "transaction_type", "VARCHAR(10) DEFAULT 'DEBIT'"),
        ("bank_transactions", "debit_amount", "DOUBLE PRECISION DEFAULT 0"),
        ("bank_transactions", "credit_amount", "DOUBLE PRECISION DEFAULT 0"),
        ("bank_transactions", "account_head_id", "INTEGER"),
        ("bank_transactions", "import_batch_id", "INTEGER"),
        ("bank_transactions", "week_number", "INTEGER"),
        ("bank_transactions", "week_year", "INTEGER"),
        ("bank_accounts", "opening_balance", "DOUBLE PRECISION DEFAULT 0"),
        ("bank_accounts", "last_statement_balance", "DOUBLE PRECISION"),
        ("bank_accounts", "last_import_at", "TIMESTAMP"),
    ]
    with engine.connect() as conn:
        for table, col, col_type in migrations:
            if table in inspector.get_table_names():
                existing = [c["name"] for c in inspector.get_columns(table)]
                if col not in existing:
                    try:
                        conn.execute(_text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                        conn.commit()
                        print(f"✅ Added column {table}.{col}")
                    except Exception as e:
                        print(f"⚠️ Column migration {table}.{col}: {e}")
        try:
            conn.execute(_text("UPDATE branches SET radius = 100.0 WHERE radius IS NULL"))
            conn.commit()
        except Exception as e:
            print(f"⚠️ Error seeding default branch radius: {e}")

try:
    _safe_add_columns()
except Exception as e:
    print(f"Migration check skipped: {e}")

# Start background scheduler
_scheduler = start_scheduler()

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(branches.router, prefix="/api/branches", tags=["branches"])
app.include_router(departments.router, prefix="/api/departments", tags=["departments"])
app.include_router(roles.router, prefix="/api/roles", tags=["roles"])
app.include_router(modules.router, prefix="/api/modules", tags=["modules"])
app.include_router(crm.router, prefix="/api/crm", tags=["crm"])
app.include_router(installation.router, prefix="/api/installation", tags=["installation"])
app.include_router(installationlayout.router, prefix="/api/installation/layout", tags=["installation-layout"])
app.include_router(service.router, prefix="/api/service", tags=["service"])
app.include_router(studio.router, prefix="/api/studio", tags=["studio"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(audit.router, prefix="/api/audit", tags=["audit"])
app.include_router(warranty.router, prefix="/api/warranty", tags=["warranty"])
app.include_router(crm_layout.router, prefix="/api/crm-layout", tags=["crm-layout"])
app.include_router(forms.router, prefix="/api/forms", tags=["Forms"])
app.include_router(konwertcare.router, prefix="/api/konwertcare", tags=["konwertcare"])
app.include_router(issue_matrix.router, prefix="/api/issue-matrix", tags=["issue-matrix"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(admin_settings.router, prefix="/api/admin/settings", tags=["admin-settings"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["Tasks"])

# ── Attendance & HR Routers ──────────────────────────────────────────────────
app.include_router(hr_employees.router, prefix="/api/hr/employees", tags=["HR-Employees"])
app.include_router(hr_shifts.router, prefix="/api/hr/shifts", tags=["HR-Shifts"])
app.include_router(hr_holidays.router, prefix="/api/hr/holidays", tags=["HR-Holidays"])
app.include_router(hr_leave.router, prefix="/api/hr/leave", tags=["HR-Leave"])
app.include_router(hr_onduty.router, prefix="/api/hr/onduty", tags=["HR-OnDuty"])
app.include_router(hr_attendance.router, prefix="/api/hr/attendance", tags=["HR-Attendance"])
app.include_router(hr_biometric.router, prefix="/api/hr/biometric", tags=["HR-Biometric"])
app.include_router(hr_salary_templates.router, prefix="/api/hr/salary-templates", tags=["Salary Templates"])
app.include_router(hr_salary_components.router, prefix="/api/hr/salary-components", tags=["Salary Components"])
app.include_router(hr_reports.router, prefix="/api/hr/reports", tags=["HR-Reports"])
app.include_router(hr_payroll.router, prefix="/api/hr/payroll", tags=["HR-Payroll"])
app.include_router(hr_notifications.router, prefix="/api/hr/notifications", tags=["HR-Notifications"])

app.include_router(hr_push_subscriptions.router, prefix="/api/hr/push-subscriptions", tags=["HR-Push-Subscriptions"])
app.include_router(hr_config.router, prefix="/api/hr/config", tags=["HR-Config"])
app.include_router(bank.router, prefix="/api/bank", tags=["Bank"])
app.include_router(finance.router, prefix="/api/finance", tags=["Finance"])


# Seed Finance module default data
from app.routers.finance import seed_finance_data as _seed_finance
_db2 = SessionLocal()
try:
    _seed_finance(_db2)
except Exception as e:
    print(f"⚠️ Finance seed skipped: {e}")
finally:
    _db2.close()


from fastapi.responses import FileResponse

# Ensure static/uploads exists
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
static_dir = os.path.join(BASE_DIR, "static")
upload_dir = os.path.join(static_dir, "uploads")

if not os.path.exists(upload_dir):
    os.makedirs(upload_dir, exist_ok=True)

@app.get("/api/uploads/{filename}")
@app.get("/api/static/uploads/{filename}")
@app.get("/uploads/{filename}")
def serve_upload(filename: str):
    file_path = os.path.join(upload_dir, filename)
    print(f"DEBUG: Serving file from {file_path}")
    if not os.path.isfile(file_path):
        print(f"DEBUG: File NOT FOUND at {file_path}")
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(file_path)

@app.get("/api/uploads/attendance/{filename}")
@app.get("/api/static/uploads/attendance/{filename}")
@app.get("/uploads/attendance/{filename}")
def serve_attendance_upload(filename: str):
    # 1. Primary path: backend/static/uploads/attendance/{filename}
    file_path = os.path.join(upload_dir, "attendance", filename)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    
    # 2. Fallback path: backend/app/static/uploads/attendance/{filename}
    fallback_path = os.path.join(BASE_DIR, "app", "static", "uploads", "attendance", filename)
    if os.path.isfile(fallback_path):
        return FileResponse(fallback_path)
        
    raise HTTPException(status_code=404, detail="Selfie file not found on disk")

# Keep the general static mount for other things
app.mount("/api/static", StaticFiles(directory=static_dir), name="static")


@app.get("/")
def root():
    return {"message": "OmniERP API Running"}

@app.get("/api/debug/uploads")
def debug_uploads():
    if not os.path.exists(upload_dir):
        return {"error": "Upload directory does not exist", "path": upload_dir}
    files = os.listdir(upload_dir)
    return {"path": upload_dir, "files": files}
