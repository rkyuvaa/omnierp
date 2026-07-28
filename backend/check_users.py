import os
import sys

# Add the current directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import engine
from sqlalchemy import text

def check():
    with engine.connect() as conn:
        try:
            res = conn.execute(text("SELECT email, is_active FROM users"))
            print("Registered Emails:")
            for row in res:
                print(f" - {row[0]} (Active: {row[1]})")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    check()
