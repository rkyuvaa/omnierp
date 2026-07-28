import sqlite3
import os

db_path = r"c:\Users\rkyuv\OneDrive\Documents\erp\backend\omnierp.db"
output_path = r"c:\Users\rkyuv\OneDrive\Documents\erp\backend\seq_check.txt"

with open(output_path, "w") as f:
    if not os.path.exists(db_path):
        f.write("DB not found")
    else:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT * FROM sequences WHERE name='service'")
            row = cursor.fetchone()
            if row:
                f.write(f"Sequence exists: {row}\n")
            else:
                f.write("Sequence 'service' MISSING!\n")
        except Exception as e:
            f.write(f"Error checking sequences: {e}\n")
        conn.close()
