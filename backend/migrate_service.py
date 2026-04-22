import os
import sys

# Add the current directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import engine
from sqlalchemy import text

def migrate():
    print("Starting Service Module Migration...")
    with engine.connect() as conn:
        try:
            print("Adding product_id to service_requests...")
            # Use text() to execute raw SQL safely
            # SQLite doesn't support ADD COLUMN IF NOT EXISTS inside ALTER TABLE
            # So we check first
            conn.execute(text("ALTER TABLE service_requests ADD COLUMN product_id INTEGER REFERENCES products(id)"))
            conn.commit()
            print("Migration successful!")
        except Exception as e:
            if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
                print("Column product_id already exists. Skipping.")
            else:
                print(f"Migration error: {e}")

if __name__ == "__main__":
    migrate()
