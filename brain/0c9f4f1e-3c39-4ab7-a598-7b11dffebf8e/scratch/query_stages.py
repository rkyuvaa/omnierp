from sqlalchemy import create_engine, text
import os
import json
from dotenv import load_dotenv

load_dotenv("backend/.env")
db_url = os.getenv("DATABASE_URL")

engine = create_engine(db_url)
with engine.connect() as conn:
    res = conn.execute(text("SELECT id, name FROM stages WHERE module='installation'"))
    data = [{"id": r[0], "name": r[1]} for r in res]
    with open("inst_stages.json", "w") as f:
        json.dump(data, f)
print("Done")
