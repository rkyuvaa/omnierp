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
        queries = [
            "ALTER TABLE crm_tabs ADD COLUMN IF NOT EXISTS visibility_stages JSONB DEFAULT '[]'::jsonb;",
            "ALTER TABLE crm_fields ADD COLUMN IF NOT EXISTS form_template_id INTEGER;"
        ]
    else:
        # SQLite
        queries = [
            "ALTER TABLE crm_tabs ADD COLUMN visibility_stages JSON DEFAULT '[]';",
            "ALTER TABLE crm_fields ADD COLUMN form_template_id INTEGER;"
        ]

    with engine.connect() as conn:
        for sql in queries:
            try:
                conn.execute(text(sql))
                conn.commit()
                print(f"Executed: {sql[:50]}...")
            except Exception as e:
                if "already exists" in str(e) or "duplicate column" in str(e):
                    pass
                else:
                    print(f"Error: {e}")

if __name__ == "__main__":
    migrate()
