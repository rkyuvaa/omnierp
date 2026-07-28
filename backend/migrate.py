import psycopg2
import os
from dotenv import load_dotenv

# Load .env file
dotenv_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(dotenv_path)

db_url = os.getenv("DATABASE_URL")
if not db_url:
    print("DATABASE_URL not found in .env")
    exit(1)

print(f"Connecting to PostgreSQL...")

try:
    conn = psycopg2.connect(db_url)
    cursor = conn.cursor()

    def add_column(table, column, type):
        try:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {type}")
            print(f"Applied: ALTER TABLE {table} ADD COLUMN {column}")
        except Exception as e:
            print(f"Error updating {table}: {e}")

    # Apply changes
    add_column("installation_tabs", "visibility_stages", "JSONB DEFAULT '[]'")
    add_column("installation_fields", "form_template_id", "INTEGER")
    add_column("products", "warranty_start_date", "DATE")
    add_column("products", "warranty_end_date", "DATE")

    conn.commit()
    cursor.close()
    conn.close()
    print("Migration complete.")

except Exception as e:
    print(f"Failed to connect or migrate: {e}")
