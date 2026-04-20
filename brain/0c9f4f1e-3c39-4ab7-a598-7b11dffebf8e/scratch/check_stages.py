import sqlite3
import os

db_path = "backend/omnierp.db"
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT id, name FROM stages WHERE module='installation'")
    rows = cursor.fetchall()
    for row in rows:
        print(f"ID: {row[0]}, Name: {row[1]}")
    conn.close()
else:
    print("Database not found at " + db_path)
