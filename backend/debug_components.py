import os
import sys

# Add the current directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.hr_models import HRSalaryComponent

def debug_components():
    db = SessionLocal()
    try:
        components = db.query(HRSalaryComponent).all()
        for c in components:
            print(f"Name: {c.name}")
            print(f"  Calc Type: {c.calc_type}")
            print(f"  Calc Value: {c.calc_value}")
            print(f"  Below: {c.apply_if_gross_below}")
            print(f"  Above: {c.apply_if_gross_above}")
            print("---")
    finally:
        db.close()

if __name__ == "__main__":
    debug_components()
