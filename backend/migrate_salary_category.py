from sqlalchemy import create_engine, text
from app.config import settings

engine = create_engine(settings.DATABASE_URL)
with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE hr_employees ADD COLUMN salary_category VARCHAR(50) DEFAULT 'regular';"))
        conn.commit()
        print("MIGRATION_SUCCESS: Successfully added column salary_category to hr_employees")
    except Exception as e:
        print("MIGRATION_ALREADY_DONE or Error:", e)
