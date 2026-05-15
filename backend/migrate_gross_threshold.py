"""
Migration: Add gross threshold columns to hr_salary_components table.
These support India compliance rules:
  - apply_if_gross_below: ESI (0.75% only if gross ≤ ₹21,000)
  - apply_if_gross_above: TDS (only if gross ≥ ₹1,00,000)

Run this once on the EC2 server after deploying.
"""
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

def migrate():
    is_pg = DATABASE_URL.startswith("postgresql")
    
    if is_pg:
        queries = [
            "ALTER TABLE hr_salary_components ADD COLUMN IF NOT EXISTS apply_if_gross_below DOUBLE PRECISION;",
            "ALTER TABLE hr_salary_components ADD COLUMN IF NOT EXISTS apply_if_gross_above DOUBLE PRECISION;",
        ]
    else:
        queries = [
            "ALTER TABLE hr_salary_components ADD COLUMN apply_if_gross_below REAL;",
            "ALTER TABLE hr_salary_components ADD COLUMN apply_if_gross_above REAL;",
        ]
    
    with engine.connect() as conn:
        for sql in queries:
            try:
                conn.execute(text(sql))
                conn.commit()
                print(f"✅ {sql.strip()}")
            except Exception as e:
                if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                    print(f"⏭️ Column already exists, skipping...")
                else:
                    print(f"❌ Error: {e}")

if __name__ == "__main__":
    migrate()
    print("\n🎉 Migration complete! New threshold fields are ready.")
