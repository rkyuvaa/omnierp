import sqlite3
import os

db_path = r"c:\Users\rkyuv\OneDrive\Documents\erp\backend\omnierp.db"
output_path = r"c:\Users\rkyuv\OneDrive\Documents\erp\backend\schema_output.txt"

with open(output_path, "w") as f:
    if not os.path.exists(db_path):
        f.write("DB not found")
    else:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        try:
            cursor.execute("PRAGMA table_info(products)")
            cols = cursor.fetchall()
            f.write("Columns in PRODUCTS table:\n")
            for c in cols:
                f.write(f"- {c[1]} ({c[2]})\n")
        except Exception as e:
            f.write(f"Error: {e}")
        conn.close()
