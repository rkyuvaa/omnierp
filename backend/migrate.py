import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "database.db")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

def add_column(table, column, type):
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
