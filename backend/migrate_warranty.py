import os
import sys

# Add the current directory to sys.path so we can import app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import engine
from sqlalchemy import text

def migrate():
    print("Starting migration...")
    with engine.connect() as conn:
        try:
            print("Adding columns to product_component_serials...")
            # Use text() to execute raw SQL safely
            conn.execute(text("ALTER TABLE product_component_serials ADD COLUMN IF NOT EXISTS warranty_start_date DATE"))
            conn.execute(text("ALTER TABLE product_component_serials ADD COLUMN IF NOT EXISTS warranty_end_date DATE"))
            conn.commit()
            print("Migration successful!")
        except Exception as e:
            print(f"Migration error: {e}")
            # If IF NOT EXISTS is not supported (standard SQL), we might get an error if already exists
            # We ignore specific error if it's already there
            pass

if __name__ == "__main__":
    migrate()
