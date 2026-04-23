
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.database import engine
from sqlalchemy import text

def migrate():
    tables = [
        "crm_tabs", 
        "installation_tabs", 
        "service_tabs", 
        "warranty_tabs", 
        "konwert_care_tabs"
    ]
    
    with engine.connect() as conn:
        for table in tables:
            print(f"Checking {table}...")
            # Check if column exists
            res = conn.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_name='{table}' AND column_name='default_on_stage'")).fetchone()
            if not res:
                print(f"Adding default_on_stage to {table}...")
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN default_on_stage INTEGER"))
                conn.commit()
            else:
                print(f"Column already exists in {table}")
    print("Migration complete!")

if __name__ == "__main__":
    migrate()
