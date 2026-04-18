from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Product, BOM
from ..auth import get_current_user

router = APIRouter()

def serialize_product(p: Product):
    return {
        "id": p.id,
        "title": p.title,
        "name": p.name,
        "serial_number": p.serial_number,
        "warranty_period": p.warranty_period,
        "warranty_unit": p.warranty_unit,
        "notes": p.notes,
        "custom_data": p.custom_data or {},
        "created_at": str(p.created_at),
        "stage_name": p.stage.name if p.stage else None,
        "stage_color": p.stage.color if p.stage else None,
    }

@router.get("/products")
def get_products(db: Session = Depends(get_db)):
    products = db.query(Product).all()
    return [serialize_product(p) for p in products]

@router.get("/products/{id}")
def get_product(id: int, db: Session = Depends(get_db)):
    p = db.query(Product).filter(Product.id == id).first()
    if not p: raise HTTPException(404)
    return p

@router.post("/products")
def create_product(data: dict, db: Session = Depends(get_db)):
    p = Product(**data)
    db.add(p); db.commit(); db.refresh(p)
    return p

@router.put("/products/{id}")
def update_product(id: int, data: dict, db: Session = Depends(get_db)):
    p = db.query(Product).filter(Product.id == id).first()
    if not p: raise HTTPException(404)
    for k, v in data.items(): setattr(p, k, v)
    db.commit(); return p

@router.get("/boms")
def get_boms(db: Session = Depends(get_db)):
    return db.query(BOM).all()
