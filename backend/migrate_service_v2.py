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
        
        # Add columns
        for name, type_ in cols:
            try:
                print(f"Adding column {name}...")
                conn.execute(text(f"ALTER TABLE service_requests ADD COLUMN {name} {type_}"))
                conn.commit()
            except Exception as e:
                print(f"Column {name} check: {e}")

        # Add indexes to speed up searches
        idx_cmds = [
            "CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)",
            "CREATE INDEX IF NOT EXISTS idx_products_serial ON products(serial_number)",
            "CREATE INDEX IF NOT EXISTS idx_products_title ON products(title)"
        ]
        for cmd in idx_cmds:
            try:
                print(f"Running: {cmd}")
                conn.execute(text(cmd))
                conn.commit()
            except Exception as e:
                print(f"Index error: {e}")
        
    print("Migration complete!")

if __name__ == "__main__":
    migrate()
