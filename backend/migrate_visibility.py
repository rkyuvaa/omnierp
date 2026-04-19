import sqlite3
import os

db_path = r"c:\Users\rkyuv\OneDrive\Documents\erp\backend\omnierp.db"

def fix_db():
    if not os.path.exists(db_path):
        print(f"DB not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    # Check crm_tabs
    cur.execute("PRAGMA table_info(crm_tabs)")
    cols = [c[1] for c in cur.fetchall()]
    if "visibility_stages" not in cols:
        print("Adding visibility_stages to crm_tabs...")
        cur.execute("ALTER TABLE crm_tabs ADD COLUMN visibility_stages JSON DEFAULT '[]'")
    else:
        print("visibility_stages already in crm_tabs")
        
    conn.commit()
    conn.close()
    print("Done")

if __name__ == "__main__":
    fix_db()
