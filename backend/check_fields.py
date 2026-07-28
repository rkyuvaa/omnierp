import sqlite3
import os

db_path = r"c:\Users\rkyuv\OneDrive\Documents\erp\backend\omnierp.db"
if not os.path.exists(db_path):
    print("DB not found at", db_path)
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT field_name, field_label FROM warranty_fields")
        rows = cursor.fetchall()
        print("Warranty Module Fields:")
        for r in rows:
            print(f"- {r[0]}: {r[1]}")
    except Exception as e:
        print("Error:", e)
    conn.close()
