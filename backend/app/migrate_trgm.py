from sqlalchemy import create_engine, text
import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))
from app.config import settings

def migrate():
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        print("Enabling pg_trgm extension...")
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm;"))
        conn.commit()
        
        print("Creating GIN trigram indexes on 'leads' table...")
        # Lead indexes
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_leads_title_trgm ON leads USING gin (title gin_trgm_ops);"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_leads_customer_name_trgm ON leads USING gin (customer_name gin_trgm_ops);"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_leads_phone_trgm ON leads USING gin (phone gin_trgm_ops);"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_leads_email_trgm ON leads USING gin (email gin_trgm_ops);"))
        conn.commit()
        
        print("Creating GIN trigram indexes on 'installations' table...")
        # Installation indexes
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_inst_customer_name_trgm ON installations USING gin (customer_name gin_trgm_ops);"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_inst_vehicle_number_trgm ON installations USING gin (vehicle_number gin_trgm_ops);"))
        conn.commit()
        
        print("Creating GIN trigram indexes on 'products' table...")
        # Product indexes
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_products_title_trgm ON products USING gin (title gin_trgm_ops);"))
        conn.commit()

        print("Migration complete!")

if __name__ == "__main__":
    try:
        migrate()
    except Exception as e:
        print(f"Error: {e}")
