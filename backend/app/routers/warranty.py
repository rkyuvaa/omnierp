from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Product, BOM
from ..auth import get_current_user

router = APIRouter()

def serialize_product(p: Product):
    try:
        return {
            "id": p.id,
            "title": p.title or "",
            "name": p.name or "",
            "serial_number": p.serial_number or "",
            "warranty_period": p.warranty_period or 0,
            "warranty_unit": p.warranty_unit or "months",
            "notes": p.notes or "",
            "custom_data": p.custom_data or {},
            "created_at": str(p.created_at) if p.created_at else "",
            "stage_name": p.stage.name if p.stage else None,
            "stage_color": p.stage.color if p.stage else None,
        }
    except Exception as e:
        print(f"Serialization error for product {getattr(p, 'id', 'unknown')}: {e}")
        return {"id": getattr(p, 'id', 0), "name": "Error loading product"}

@router.get("/products")
def get_products(db: Session = Depends(get_db)):
    try:
        products = db.query(Product).all()
        return [serialize_product(p) for p in products]
    except Exception as e:
        print(f"Error in get_products: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/products/{id}")
def get_product(id: int, db: Session = Depends(get_db)):
    p = db.query(Product).filter(Product.id == id).first()
    if not p: raise HTTPException(404)
    return serialize_product(p)

@router.post("/products")
def create_product(data: dict, db: Session = Depends(get_db)):
    try:
        # Filter out fields that are NOT in the Product model
        valid_fields = ["title", "name", "serial_number", "warranty_period", "warranty_unit", "stage_id", "notes", "custom_data"]
        product_data = {k: v for k, v in data.items() if k in valid_fields}
        
        p = Product(**product_data)
        db.add(p); db.commit(); db.refresh(p)
        return serialize_product(p)
    except Exception as e:
        print(f"Error in create_product: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/products/{id}")
def update_product(id: int, data: dict, db: Session = Depends(get_db)):
    try:
        p = db.query(Product).filter(Product.id == id).first()
        if not p: raise HTTPException(404)
        
        valid_fields = ["title", "name", "serial_number", "warranty_period", "warranty_unit", "stage_id", "notes", "custom_data"]
        for k, v in data.items():
            if k in valid_fields:
                setattr(p, k, v)
        
        db.commit()
        return serialize_product(p)
    except Exception as e:
        print(f"Error in update_product: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/boms")
def get_boms(db: Session = Depends(get_db)):
    return db.query(BOM).all()

@router.get("/boms/{id}")
def get_bom(id: int, db: Session = Depends(get_db)):
    b = db.query(BOM).filter(BOM.id == id).first()
    if not b: raise HTTPException(404)
    return b

@router.post("/boms")
def create_bom(data: dict, db: Session = Depends(get_db)):
    b = BOM(**data)
    db.add(b); db.commit(); db.refresh(b)
    return b

@router.put("/boms/{id}")
def update_bom(id: int, data: dict, db: Session = Depends(get_db)):
    b = db.query(BOM).filter(BOM.id == id).first()
    if not b: raise HTTPException(404)
    for k, v in data.items(): setattr(b, k, v)
    db.commit(); return b
