import sqlite3
import json
import os

db_path = "backend/omnierp.db"
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, module FROM stages")
    rows = cursor.fetchall()
    data = [{"id": r[0], "name": r[1], "module": r[2]} for r in rows]
    with open("stages_dump.json", "w") as f:
        json.dump(data, f, indent=2)
    conn.close()
    print("Stages dumped to stages_dump.json")
else:
    print("Database not found")
