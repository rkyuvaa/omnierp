import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

# Try environment variable, or standard local fallbacks
db_urls = [
    os.getenv("DATABASE_URL"),
    "postgresql://erp_user:erp_pass@localhost:5432/erp_db",
    "postgresql://postgres:postgres@localhost:5432/erp_db",
    "postgresql://erp_user:password@localhost:5432/erp_db",
    "sqlite:///./omnierp.db"
]

def migrate():
    engine = None
    for url in db_urls:
        if not url: continue
        try:
            e = create_engine(url)
            with e.connect() as conn:
                print(f"Connected to DB using: {url.split('@')[-1] if '@' in url else url}")
                engine = e
                break
        except Exception:
            continue
            
    if not engine:
        from app.database import engine

    with engine.connect() as conn:
        print("Migrating Database for CC Notifications...")
        
        # 1. Add cc_manager_ids to hr_employees if not exists
        try:
            conn.execute(text("ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS cc_manager_ids JSON DEFAULT '[]';"))
            print("✓ Added cc_manager_ids column to hr_employees")
        except Exception as e:
            print(f"Notice on hr_employees: {e}")

        # 2. Add cc_employee_ids to hr_leave_requests if not exists
        try:
            conn.execute(text("ALTER TABLE hr_leave_requests ADD COLUMN IF NOT EXISTS cc_employee_ids JSON DEFAULT '[]';"))
            print("✓ Added cc_employee_ids column to hr_leave_requests")
        except Exception as e:
            print(f"Notice on hr_leave_requests: {e}")
            
        # 3. Copy manager_l2_id into cc_manager_ids if manager_l2_id is set and cc_manager_ids is empty or null
        try:
            conn.execute(text("""
                UPDATE hr_employees 
                SET cc_manager_ids = json_build_array(manager_l2_id)
                WHERE manager_l2_id IS NOT NULL 
                AND (cc_manager_ids IS NULL OR cc_manager_ids::text = '[]' OR cc_manager_ids::text = 'null');
            """))
            print("✓ Migrated existing manager_l2_id to cc_manager_ids array")
        except Exception as e:
            print(f"Notice on migration of manager_l2_id: {e}")
            
        conn.commit()
        print("Migration complete!")

if __name__ == "__main__":
    migrate()
