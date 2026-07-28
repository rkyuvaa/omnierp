import sys
import os
sys.path.append(os.getcwd())
from sqlalchemy.orm import Session
from app.database import engine
from app.models import CRMField

with Session(engine) as session:
    print("--- ORPHANED FIELDS (No Tab) ---")
    fields = session.query(CRMField).filter(CRMField.module == 'warranty', CRMField.tab_id == None).all()
    for f in fields:
        print(f"Label: {f.field_label} | Name: {f.field_name} | Active: {f.is_active}")
