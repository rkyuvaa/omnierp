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
        ("customer_id", "INTEGER"),
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

    # 2. Add High-Performance Trigram Indexes (Postgres)
    idx_cmds = [
        "CREATE EXTENSION IF NOT EXISTS pg_trgm",
        "CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING GIN (name gin_trgm_ops)",
        "CREATE INDEX IF NOT EXISTS idx_products_serial_trgm ON products USING GIN (serial_number gin_trgm_ops)",
        "CREATE INDEX IF NOT EXISTS idx_products_title_trgm ON products USING GIN (title gin_trgm_ops)"
    ]
    for cmd in idx_cmds:
        with engine.connect() as conn:
            try:
                print(f"Running Performance Index: {cmd}")
                conn.execute(text(cmd))
                conn.commit()
                print(f"SUCCESS: Performance Index applied.")
            except Exception as e:
                # Fallback to standard B-Tree if GIN fails (non-postgres)
                print(f"Postgres index failed, skipping GIN: {e}")
                
    # Standard B-Tree for safe measures
    btree_cmds = [
        "CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)",
        "CREATE INDEX IF NOT EXISTS idx_products_serial ON products(serial_number)",
        "CREATE INDEX IF NOT EXISTS idx_products_title ON products(title)"
    ]
    for cmd in btree_cmds:
        with engine.connect() as conn:
            try:
                conn.execute(text(cmd))
                conn.commit()
            except: pass
        
    # 3. Reset Service Sequence
    with engine.connect() as conn:
        try:
            print("Resetting Service Sequence to 1...")
            conn.execute(text("UPDATE sequences SET current_number = 0 WHERE module = 'service'"))
            conn.commit()
            print("SUCCESS: Sequence reset.")
        except: pass
        
    print("Migration complete!")

if __name__ == "__main__":
    migrate()
