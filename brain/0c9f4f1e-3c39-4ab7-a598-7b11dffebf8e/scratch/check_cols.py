from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv("backend/.env")
db_url = os.getenv("DATABASE_URL")

engine = create_engine(db_url)
with engine.connect() as conn:
    res = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='konwert_care_tickets'"))
    cols = [r[0] for r in res]
    with open("cols_dump.txt", "w") as f:
        f.write("\n".join(cols))
print("Done")
