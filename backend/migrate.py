import sqlite3
import os
import subprocess

# Try to find all .db files in the erp directory
try:
    find_cmd = "find /home/ubuntu/erp -name '*.db'"
    db_files = subprocess.check_output(find_cmd, shell=True).decode().split('\n')
    db_files = [f for f in db_files if f.strip()]
except:
    db_files = []

print(f"Candidate DB files: {db_files}")

for db_path in db_files:
    print(f"\nChecking: {db_path}")
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [t[0] for t in cursor.fetchall()]
        print(f"Tables: {', '.join(tables)}")
        
        if "leads" in tables or "crm_tabs" in tables:
            print(">>> THIS LOOKS LIKE THE ACTIVE DATABASE! <<<")
            
            def add_column(table, column, type):
                if table not in tables:
                    print(f"SKIPPING: Table {table} does not exist in this DB.")
                    return
                try:
                    cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {type}")
                    print(f"Added {column} to {table}")
                except sqlite3.OperationalError as e:
                    if "duplicate column name" in str(e):
                        print(f"Column {column} already exists in {table}")
                    else:
                        print(f"Error adding {column} to {table}: {e}")

            add_column("installation_tabs", "visibility_stages", "JSON DEFAULT '[]'")
            add_column("installation_fields", "form_template_id", "INTEGER")
            
            conn.commit()
            print("Migration applied to this DB.")
        
        conn.close()
    except Exception as e:
        print(f"Error checking {db_path}: {e}")

print("\nSearch and migration finished.")
