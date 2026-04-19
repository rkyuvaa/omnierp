import sys
import os
sys.path.append(os.getcwd())
from sqlalchemy.orm import Session
from app.database import engine
from app.models import CRMField, CRMTab

with Session(engine) as session:
    print("--- INACTIVE FIELDS ---")
    fields = session.query(CRMField).filter(CRMField.module == 'warranty', CRMField.is_active == False).all()
    for f in fields:
        print(f"DEACTIVATED: Label: {f.field_label} | Name: {f.field_name}")

    print("\n--- INACTIVE TABS ---")
    tabs = session.query(CRMTab).filter(CRMTab.module == 'warranty', CRMTab.is_active == False).all()
    for t in tabs:
        print(f"DEACTIVATED: Tab: {t.name}")
