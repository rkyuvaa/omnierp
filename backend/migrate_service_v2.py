import os
import sys

# Add the current directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import engine
from sqlalchemy import text

def migrate():
    print("Starting Comprehensive Service Module Migration...")
    with engine.connect() as conn:
        cols = [
            ("product_id", "INTEGER REFERENCES products(id)"),
            ("phone", "VARCHAR(50)"),
            ("invoice_number", "VARCHAR(50)"),
            ("vehicle_year", "VARCHAR(10)"),
            ("delivery_date", "DATE")
        ]
        
        for name, type_ in cols:
            try:
                print(f"Adding column {name}...")
                conn.execute(text(f"ALTER TABLE service_requests ADD COLUMN {name} {type_}"))
                conn.commit()
            except Exception as e:
                if "duplicate" in str(e).lower() or "already exists" in str(e).lower():
                    print(f"Column {name} already exists.")
                else:
                    print(f"Error adding {name}: {e}")
        
    print("Migration complete!")

if __name__ == "__main__":
    migrate()
