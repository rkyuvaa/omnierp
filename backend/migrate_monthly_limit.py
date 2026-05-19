from sqlalchemy import create_engine, text
from app.config import settings

engine = create_engine(settings.DATABASE_URL)
with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE hr_leave_balances ADD COLUMN monthly_limit FLOAT DEFAULT 0.0;"))
        conn.commit()
        print("MIGRATION_SUCCESS: Successfully added column monthly_limit to hr_leave_balances")
    except Exception as e:
        print("MIGRATION_ALREADY_DONE or Error:", e)
