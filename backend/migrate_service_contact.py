import sys
import os
sys.path.append(os.getcwd())

from app.database import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        print("Adding contact_name and contact_number to service_requests...")
        try:
            conn.execute(text("ALTER TABLE service_requests ADD COLUMN contact_name VARCHAR(100)"))
            print("Added contact_name.")
        except Exception as e:
            print(f"contact_name might already exist: {e}")
            
        try:
            conn.execute(text("ALTER TABLE service_requests ADD COLUMN contact_number VARCHAR(50)"))
            print("Added contact_number.")
        except Exception as e:
            print(f"contact_number might already exist: {e}")
        
        conn.commit()
    print("Migration finished.")

if __name__ == "__main__":
    migrate()
