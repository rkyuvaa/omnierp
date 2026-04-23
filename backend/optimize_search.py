import sys
import os
sys.path.append(os.getcwd())

from app.database import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        print("Optimizing database indexes for search performance...")
        
        # Products table indexes
        indexes = [
            ("idx_products_title", "products", "title"),
            ("idx_products_name", "products", "name"),
            ("idx_products_serial", "products", "serial_number"),
            ("idx_service_cust", "service_requests", "customer_name"),
            ("idx_service_veh", "service_requests", "vehicle_number"),
            ("idx_service_ref", "service_requests", "reference"),
            ("idx_leads_name", "leads", "customer_name"),
            ("idx_leads_phone", "leads", "phone"),
            ("idx_install_ref", "installations", "reference"),
            ("idx_install_cust", "installations", "customer_name"),
            ("idx_install_veh", "installations", "vehicle_number"),
        ]
        
        for idx_name, table, col in indexes:
            try:
                print(f"Creating index {idx_name} on {table}({col})...")
                # PostgreSQL/SQLite compatible index creation check if possible, or just try/except
                conn.execute(text(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {table} ({col})"))
            except Exception as e:
                print(f"Index {idx_name} failed or exists: {e}")
        
        conn.commit()
    print("Optimization finished.")

if __name__ == "__main__":
    migrate()
