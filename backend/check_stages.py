from app.database import SessionLocal
from app.models import Stage, Product

db = SessionLocal()
stages = db.query(Stage).all()
print("STAGES IN DB:")
for s in stages:
    print(f"ID: {s.id}, Name: {s.name}, Module: {s.module}")

warranty_prods = db.query(Product).all()
print("\nPRODUCT STAGE IDs:")
for p in warranty_prods:
    print(f"Prod ID: {p.id}, Stage ID: {p.stage_id}")

db.close()
