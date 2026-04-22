import sqlite3
import json
import os

db_path = r"c:\Users\rkyuv\OneDrive\Documents\erp\backend\omnierp.db"
if not os.path.exists(db_path):
    print("DB not found")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        # Get one product with custom_data
        cursor.execute("SELECT id, name, serial_number, custom_data FROM products WHERE name IS NOT NULL LIMIT 5")
        rows = cursor.fetchall()
        print("Products Custom Data Dump:")
        for r in rows:
            print(f"ID: {r[0]}, Name: {r[1]}, Serial: {r[2]}")
            try:
                cd = json.loads(r[3])
                print(f"Keys: {list(cd.keys())}")
                print(f"Content: {cd}")
            except:
                print("No valid JSON in custom_data")
            print("-" * 20)
    except Exception as e:
        print("Error:", e)
    conn.close()
