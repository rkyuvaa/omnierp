import sqlite3
import os

# Check common locations
paths = [
    os.path.join(os.path.dirname(__file__), "database.db"),
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "database.db"),
    "/home/ubuntu/erp/backend/database.db",
    "/home/ubuntu/erp/database.db"
]

db_path = None
for p in paths:
    if os.path.exists(p):
        db_path = p
        print(f"Found database at: {p}")
        break

if not db_path:
    print("Could not find database.db anywhere!")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# List all tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = [t[0] for t in cursor.fetchall()]
print(f"Existing tables: {', '.join(tables)}")

def add_column(table, column, type):
    if table not in tables:
        print(f"SKIPPING: Table {table} does not exist.")
        return
    try:
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {type}")
        print(f"Added {column} to {table}")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print(f"Column {column} already exists in {table}")
        else:
            print(f"Error adding {column} to {table}: {e}")

# Apply changes
add_column("installation_tabs", "visibility_stages", "JSON DEFAULT '[]'")
add_column("installation_fields", "form_template_id", "INTEGER")

conn.commit()
conn.close()
print("Migration complete.")
