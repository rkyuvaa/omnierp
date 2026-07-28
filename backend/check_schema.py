import sqlite3
import os

db_path = r"c:\Users\rkyuv\OneDrive\Documents\erp\backend\omnierp.db"
if not os.path.exists(db_path):
    print("DB not found")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("PRAGMA table_info(products)")
        cols = cursor.fetchall()
        print("Columns in PRODUCTS table:")
        for c in cols:
            print(f"- {c[1]} ({c[2]})")
    except Exception as e:
        print("Error:", e)
    conn.close()
