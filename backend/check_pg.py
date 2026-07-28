import os
from sqlalchemy import create_engine, text

# Get DB URL from env or config
# For this task, I will try to use the engine if possible
from app.database import engine

def check():
    with engine.connect() as conn:
        try:
            # Check service_requests columns
            res = conn.execute(text("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'service_requests'"))
            print("Columns in service_requests:")
            for row in res:
                print(row)
        except Exception as e:
            print("Error:", e)

if __name__ == "__main__":
    check()
