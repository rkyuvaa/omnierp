import sys
import os
sys.path.append(os.getcwd())

from app.database import engine, Base
from app.models import Component, BOMComponent
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
import sqlalchemy as sa

def migrate():
    with engine.connect() as conn:
        print("Creating components_master table...")
        # Create components_master if not exists
        if not engine.dialect.has_table(conn, "components_master"):
            Component.__table__.create(engine)
            print("Table components_master created.")
        else:
            print("Table components_master already exists.")

        # Add component_id to bom_components if not exists
        print("Updating bom_components table...")
        inspector = sa.inspect(engine)
        cols = [c['name'] for c in inspector.get_columns('bom_components')]
        if 'component_id' not in cols:
            conn.execute(sa.text("ALTER TABLE bom_components ADD COLUMN component_id INTEGER REFERENCES components_master(id)"))
            print("Added component_id to bom_components.")
        else:
            print("component_id already exists in bom_components.")
        
        conn.commit()
    print("Migration finished.")

if __name__ == "__main__":
    migrate()
