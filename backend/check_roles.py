import os
import sys

# Add current directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), ".")))

from app.database import SessionLocal
from app.models import Role

def check():
    db = SessionLocal()
    try:
        roles = db.query(Role).all()
        print(f"Total Roles: {len(roles)}")
        for r in roles:
            print(f"Role ID: {r.id}")
            print(f" - Name: {r.name}")
            print(f" - Permissions: {r.permissions}")
            print("-" * 40)
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check()
