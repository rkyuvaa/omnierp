from app.database import SessionLocal
from app.models import FormDefinition

db = SessionLocal()
forms = db.query(FormDefinition).filter(FormDefinition.module == "payroll").all()
for f in forms:
    print(f"ID: {f.id}, Name: {f.name}, Active: {f.is_active}")
    print(f"Fields Config: {f.fields_config}")
