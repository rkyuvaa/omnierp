import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import engine
from app.models import ProductCategory, TaxConfig, Base
import sqlalchemy as sa

def migrate():
    with engine.connect() as conn:
        inspector = sa.inspect(engine)
        tables = inspector.get_table_names()

        if "product_categories" not in tables:
            ProductCategory.__table__.create(engine)
            print("✓ Created table: product_categories")
        else:
            print("• Table product_categories already exists")

        if "tax_configs" not in tables:
            TaxConfig.__table__.create(engine)
            print("✓ Created table: tax_configs")
        else:
            print("• Table tax_configs already exists")

        conn.commit()
    print("✓ Migration complete.")

if __name__ == "__main__":
    migrate()
