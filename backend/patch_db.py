import sys
import os
from sqlalchemy import create_all, text
from sqlalchemy.orm import Session

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from app.database import engine, Base
from app.models import *

def patch_db():
    print("Starting Deep Analysis & Patching of Database Schema...")
    
    with engine.connect() as conn:
        # Define the columns that might be missing
        patches = [
            # Module, Table, Column, Type
            ("crm", "crm_tabs", "visibility_stages", "JSON DEFAULT '[]'"),
            ("crm", "crm_tabs", "module", "VARCHAR(50) DEFAULT 'crm'"),
            ("crm", "crm_fields", "module", "VARCHAR(50) DEFAULT 'crm'"),
            ("crm", "crm_fields", "form_template_id", "INTEGER"),
            ("crm", "crm_fields", "is_active", "BOOLEAN DEFAULT TRUE"),
            
            ("installation", "installation_tabs", "visibility_stages", "JSON DEFAULT '[]'"),
            ("installation", "installation_fields", "form_template_id", "INTEGER"),
            
            ("service", "service_tabs", "visibility_stages", "JSON DEFAULT '[]'"),
            ("service", "service_fields", "form_template_id", "INTEGER"),

            ("warranty", "warranty_tabs", "visibility_stages", "JSON DEFAULT '[]'"),
            ("warranty", "warranty_fields", "form_template_id", "INTEGER"),

            ("konwertcare", "konwert_care_tabs", "visibility_stages", "JSON DEFAULT '[]'"),
            ("konwertcare", "konwert_care_fields", "form_template_id", "INTEGER"),
        ]
        
        for module, table, col, col_type in patches:
            try:
                # Check if column exists
                check_sql = text(f"SELECT column_name FROM information_schema.columns WHERE table_name='{table}' AND column_name='{col}';")
                result = conn.execute(check_sql).fetchone()
                
                if not result:
                    print(f"  [+] Adding {col} to {table}...")
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type};"))
                    conn.commit()
                else:
                    print(f"  [ ] {col} already exists in {table}.")
            except Exception as e:
                print(f"  [!] Error patching {table}.{col}: {e}")

    # Also trigger Base.metadata.create_all to ensure NEW tables are created
    print("Ensuring all new tables exist...")
    Base.metadata.create_all(bind=engine)
    print("Database Patching Complete.")

if __name__ == "__main__":
    patch_db()
