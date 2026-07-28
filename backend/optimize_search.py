import sys
import os
sys.path.append(os.getcwd())

from app.database import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        print("Optimizing database indexes with pg_trgm for high-performance wildcard searches...")
        
        # Enable pg_trgm extension
        try:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
            conn.commit()
            print("Extension pg_trgm enabled.")
        except Exception as e:
            print(f"Failed to enable pg_trgm (might lack superuser perms): {e}")

        # Trigram indexes for GIN (faster for search)
        # Using gin_trgm_ops for ILIKE %search% optimization
        indexes = [
            ("idx_products_title_trgm", "products", "title"),
            ("idx_products_name_trgm", "products", "name"),
            ("idx_products_serial_trgm", "products", "serial_number"),
            ("idx_service_cust_trgm", "service_requests", "customer_name"),
            ("idx_service_veh_trgm", "service_requests", "vehicle_number"),
            ("idx_service_ref_trgm", "service_requests", "reference"),
            ("idx_leads_name_trgm", "leads", "customer_name"),
            ("idx_leads_ref_trgm", "leads", "reference"),
            ("idx_leads_title_trgm", "leads", "title"),
            ("idx_install_ref_trgm", "installations", "reference"),
            ("idx_install_cust_trgm", "installations", "customer_name"),
            ("idx_install_veh_trgm", "installations", "vehicle_number"),
        ]
        
        for idx_name, table, col in indexes:
            try:
                # Drop existing standard index if we want to replace, or just add
                # conn.execute(text(f"DROP INDEX IF EXISTS {idx_name.replace('_trgm', '')}"))
                
                print(f"Creating GIN Trigram index {idx_name} on {table}({col})...")
                # PostgreSQL specific GIN trigram index
                conn.execute(text(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {table} USING gin ({col} gin_trgm_ops)"))
                conn.commit()
            except Exception as e:
                print(f"Index {idx_name} failed: {e}")
        
    print("Search optimization finished.")

if __name__ == "__main__":
    migrate()
