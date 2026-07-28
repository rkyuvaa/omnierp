from sqlalchemy import create_engine, text
from app.config import settings

def update_schema():
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        print("Checking HRShift table for missing columns...")
        
        # Add half_day_late_minutes
        try:
            conn.execute(text("ALTER TABLE hr_shifts ADD COLUMN half_day_late_minutes INTEGER DEFAULT 120"))
            conn.commit()
            print("Added column half_day_late_minutes")
        except Exception as e:
            print(f"Skipping half_day_late_minutes: {e}")

        # Add half_day_early_minutes
        try:
            conn.execute(text("ALTER TABLE hr_shifts ADD COLUMN half_day_early_minutes INTEGER DEFAULT 120"))
            conn.commit()
            print("Added column half_day_early_minutes")
        except Exception as e:
            print(f"Skipping half_day_early_minutes: {e}")

if __name__ == "__main__":
    update_schema()
