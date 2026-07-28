
import json
from app.database import SessionLocal
from app.models import Lead

db = SessionLocal()
leads = db.query(Lead).filter(Lead.custom_data != {}).limit(10).all()

results = []
for lead in leads:
    results.append({
        "id": lead.id,
        "ref": lead.reference,
        "custom_data": lead.custom_data
    })

with open("db_dump.json", "w") as f:
    json.dump(results, f, indent=2)

db.close()
print("Dumped 10 leads to db_dump.json")
