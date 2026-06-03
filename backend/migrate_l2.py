import sys
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("Error: DATABASE_URL not found in .env")
    sys.exit(1)

engine = create_engine(DATABASE_URL)

def migrate():
    is_postgres = DATABASE_URL.startswith("postgresql")
    
    if is_postgres:
        queries = [
            "ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS manager_l2_id INTEGER;",
            "ALTER TABLE hr_leave_requests ADD COLUMN IF NOT EXISTS l1_approver_id INTEGER;",
            "ALTER TABLE hr_leave_requests ADD COLUMN IF NOT EXISTS l1_status VARCHAR(20) DEFAULT 'pending';",
            "ALTER TABLE hr_leave_requests ADD COLUMN IF NOT EXISTS l1_remarks TEXT;",
            "ALTER TABLE hr_leave_requests ADD COLUMN IF NOT EXISTS l1_approved_at TIMESTAMP;",
            "ALTER TABLE hr_leave_requests ADD COLUMN IF NOT EXISTS l2_approver_id INTEGER;",
            "ALTER TABLE hr_leave_requests ADD COLUMN IF NOT EXISTS l2_status VARCHAR(20);",
            "ALTER TABLE hr_leave_requests ADD COLUMN IF NOT EXISTS l2_remarks TEXT;",
            "ALTER TABLE hr_leave_requests ADD COLUMN IF NOT EXISTS l2_approved_at TIMESTAMP;",
            
            "ALTER TABLE hr_onduty_requests ADD COLUMN IF NOT EXISTS l1_approver_id INTEGER;",
            "ALTER TABLE hr_onduty_requests ADD COLUMN IF NOT EXISTS l1_status VARCHAR(20) DEFAULT 'pending';",
            "ALTER TABLE hr_onduty_requests ADD COLUMN IF NOT EXISTS l1_remarks TEXT;",
            "ALTER TABLE hr_onduty_requests ADD COLUMN IF NOT EXISTS l1_approved_at TIMESTAMP;",
            "ALTER TABLE hr_onduty_requests ADD COLUMN IF NOT EXISTS l2_approver_id INTEGER;",
            "ALTER TABLE hr_onduty_requests ADD COLUMN IF NOT EXISTS l2_status VARCHAR(20);",
            "ALTER TABLE hr_onduty_requests ADD COLUMN IF NOT EXISTS l2_remarks TEXT;",
            "ALTER TABLE hr_onduty_requests ADD COLUMN IF NOT EXISTS l2_approved_at TIMESTAMP;"
        ]
    else:
        # SQLite doesn't cleanly support IF NOT EXISTS for columns in older versions, but typically we are on Postgres.
        queries = [
            "ALTER TABLE hr_employees ADD COLUMN manager_l2_id INTEGER;",
            "ALTER TABLE hr_leave_requests ADD COLUMN l1_approver_id INTEGER;",
            "ALTER TABLE hr_leave_requests ADD COLUMN l1_status VARCHAR(20) DEFAULT 'pending';",
            "ALTER TABLE hr_leave_requests ADD COLUMN l1_remarks TEXT;",
            "ALTER TABLE hr_leave_requests ADD COLUMN l1_approved_at TIMESTAMP;",
            "ALTER TABLE hr_leave_requests ADD COLUMN l2_approver_id INTEGER;",
            "ALTER TABLE hr_leave_requests ADD COLUMN l2_status VARCHAR(20);",
            "ALTER TABLE hr_leave_requests ADD COLUMN l2_remarks TEXT;",
            "ALTER TABLE hr_leave_requests ADD COLUMN l2_approved_at TIMESTAMP;",

            "ALTER TABLE hr_onduty_requests ADD COLUMN l1_approver_id INTEGER;",
            "ALTER TABLE hr_onduty_requests ADD COLUMN l1_status VARCHAR(20) DEFAULT 'pending';",
            "ALTER TABLE hr_onduty_requests ADD COLUMN l1_remarks TEXT;",
            "ALTER TABLE hr_onduty_requests ADD COLUMN l1_approved_at TIMESTAMP;",
            "ALTER TABLE hr_onduty_requests ADD COLUMN l2_approver_id INTEGER;",
            "ALTER TABLE hr_onduty_requests ADD COLUMN l2_status VARCHAR(20);",
            "ALTER TABLE hr_onduty_requests ADD COLUMN l2_remarks TEXT;",
            "ALTER TABLE hr_onduty_requests ADD COLUMN l2_approved_at TIMESTAMP;"
        ]

    with engine.connect() as conn:
        for sql in queries:
            try:
                conn.execute(text(sql))
                conn.commit()
                print(f"Executed: {sql[:60]}...")
            except Exception as e:
                if "already exists" in str(e) or "duplicate column" in str(e):
                    pass
                else:
                    print(f"Error: {e}")

if __name__ == "__main__":
    migrate()
