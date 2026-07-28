import time
import os
import sys
from sqlalchemy import create_engine, or_, func
from sqlalchemy.orm import sessionmaker

# Add backend to path to import models
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.models import Lead, Installation
from app.config import settings

engine = create_engine(settings.DATABASE_URL)
Session = sessionmaker(bind=engine)
db = Session()

def benchmark_search(search_term):
    print(f"Benchmarking search for: '{search_term}'")
    
    # Lead Search
    start = time.time()
    count = db.query(Lead).filter(or_(Lead.title.ilike(f"%{search_term}%"), Lead.customer_name.ilike(f"%{search_term}%"))).count()
    end_count = time.time()
    
    items = db.query(Lead).filter(or_(Lead.title.ilike(f"%{search_term}%"), Lead.customer_name.ilike(f"%{search_term}%"))).limit(50).all()
    end_all = time.time()
    
    print(f"Lead Count took: {end_count - start:.4f}s (Total found: {count})")
    print(f"Lead All (50) took: {end_all - end_count:.4f}s")

    # Installation Search
    start = time.time()
    count_inst = db.query(Installation).filter(or_(Installation.customer_name.ilike(f"%{search_term}%"), Installation.reference.ilike(f"%{search_term}%"))).count()
    end_count_inst = time.time()
    
    print(f"Installation Count took: {end_count_inst - start:.4f}s (Total found: {count_inst})")

if __name__ == "__main__":
    benchmark_search("test")
    benchmark_search("a")
