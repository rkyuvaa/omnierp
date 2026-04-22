import sys
import os
from sqlalchemy import create_engine, text

# Add the parent directory to sys.path to import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.config import settings

engine = create_engine(settings.DATABASE_URL)

def migrate():
    with engine.connect() as conn:
        print("Starting Database Optimization...")
        
        # 1. Enable pg_trgm for substring search
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
        
        # 2. Add indices to AuditLog
        print("Optimizing AuditLog table...")
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_audit_module ON audit_logs (module)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_audit_record_id ON audit_logs (record_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs (action)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_audit_ref_trgm ON audit_logs USING gin (record_ref gin_trgm_ops)"))
        
        # 3. Add indices to Leads (Standard fields)
        print("Optimizing Leads table...")
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_lead_title_trgm ON leads USING gin (title gin_trgm_ops)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_lead_cust_trgm ON leads USING gin (customer_name gin_trgm_ops)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_lead_ref_trgm ON leads USING gin (reference gin_trgm_ops)"))
        
        # 4. Add GIN index for JSONB (if using JSONB, but OmniERP uses JSON)
        # Note: In PostgreSQL, gin index on standard JSON is limited, but we can index specific paths or cast.
        # For now, trgm on main fields is the biggest win.
        
        conn.commit()
        print("Optimization Complete!")

if __name__ == "__main__":
    migrate()
