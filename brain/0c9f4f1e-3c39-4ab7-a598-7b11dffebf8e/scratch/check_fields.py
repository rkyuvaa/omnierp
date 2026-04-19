import sys
import os

# Add the project root to path
sys.path.append(os.getcwd())

from sqlalchemy import create_url
from sqlalchemy.orm import Session
from app.database import engine
from app.models import CRMField, CRMTab

with Session(engine) as session:
    print("--- WARRANTY TABS ---")
    tabs = session.query(CRMTab).filter(CRMTab.module == 'warranty').all()
    for t in tabs:
        print(f"Tab: {t.name} (ID: {t.id}, Active: {t.is_active})")
        
    print("\n--- WARRANTY FIELDS ---")
    fields = session.query(CRMField).filter(CRMField.module == 'warranty').all()
    for f in fields:
        print(f"Label: {f.field_label} | Name: {f.field_name} | Tab ID: {f.tab_id} | Active: {f.is_active}")
