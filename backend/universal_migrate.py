import sys
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Path to .env file in the current directory (backend/)
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("Error: DATABASE_URL not found in .env")
    sys.exit(1)

engine = create_engine(DATABASE_URL)

def migrate():
    is_postgres = DATABASE_URL.startswith("postgresql")
    
    # SQL to add the column if it doesn't exist
    if is_postgres:
        sql = "ALTER TABLE crm_tabs ADD COLUMN IF NOT EXISTS visibility_stages JSONB DEFAULT '[]'::jsonb;"
    else:
        # SQLite doesn't support IF NOT EXISTS for columns, but we can catch the error
        sql = "ALTER TABLE crm_tabs ADD COLUMN visibility_stages JSON DEFAULT '[]';"

    with engine.connect() as conn:
        try:
            conn.execute(text(sql))
            conn.commit()
            print("Successfully added 'visibility_stages' to 'crm_tabs'")
        except Exception as e:
            if "already exists" in str(e) or "duplicate column" in str(e):
                print("Column 'visibility_stages' already exists.")
            else:
                print(f"Error during migration: {e}")

if __name__ == "__main__":
    migrate()
