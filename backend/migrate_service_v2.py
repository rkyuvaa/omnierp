import os
import sys

# Add the current directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import engine
from sqlalchemy import text

def migrate():
    print("Starting Robust Service Module Migration...")
    
    # 1. Add Columns
    cols = [
        ("product_id", "INTEGER REFERENCES products(id)"),
        ("phone", "VARCHAR(50)"),
        ("invoice_number", "VARCHAR(50)"),
        ("vehicle_year", "VARCHAR(10)"),
        ("delivery_date", "DATE")
    ]
    
    for name, type_ in cols:
        with engine.connect() as conn:
            try:
                print(f"Checking/Adding column {name}...")
                conn.execute(text(f"ALTER TABLE service_requests ADD COLUMN {name} {type_}"))
                conn.commit()
                print(f"SUCCESS: Added {name}")
            except Exception as e:
                # Handle "already exists" for Postgres (DuplicateColumn) or other DBs
                if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                    print(f"SKIP: {name} already exists.")
                else:
                    print(f"ERROR: {name}: {e}")

    # 2. Add Indexes
    idx_cmds = [
        "CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)",
        "CREATE INDEX IF NOT EXISTS idx_products_serial ON products(serial_number)",
        "CREATE INDEX IF NOT EXISTS idx_products_title ON products(title)"
    ]
    for cmd in idx_cmds:
        with engine.connect() as conn:
            try:
                print(f"Running: {cmd}")
                conn.execute(text(cmd))
                conn.commit()
                print(f"SUCCESS: Index applied.")
            except Exception as e:
                print(f"Index error/skip: {e}")
        
    print("Migration complete!")

if __name__ == "__main__":
    migrate()
