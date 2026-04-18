from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Product, BOM, BOMComponent, ProductComponentSerial
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
            "component_serials": [{
                "bom_component_id": c.bom_component_id,
                "name": c.bom_component.name if c.bom_component else "",
                "serial_number": c.serial_number or "",
                "warranty_period": c.warranty_period,
                "warranty_unit": c.warranty_unit
            } for c in p.component_serials]
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
        comps = data.pop("component_serials", [])
        valid_fields = ["title", "name", "serial_number", "warranty_period", "warranty_unit", "stage_id", "notes", "custom_data", "bom_id"]
        product_data = {k: v for k, v in data.items() if k in valid_fields}
        
        # Convert empty serial_number to None to avoid unique constraint clash when empty
        if not product_data.get("serial_number"):
            product_data["serial_number"] = None

        # Default title to BOM name if title is empty
        if not product_data.get("title") and product_data.get("bom_id"):
            bom = db.query(BOM).filter(BOM.id == product_data["bom_id"]).first()
            if bom: product_data["title"] = bom.name

        p = Product(**product_data)
        db.add(p); db.commit(); db.refresh(p)

        for c in comps:
            # Remove helper fields like 'name' before saving to ProductComponentSerial
            cs_data = {k: v for k, v in c.items() if k in ["bom_component_id", "serial_number", "warranty_period", "warranty_unit"]}
            cs = ProductComponentSerial(**cs_data, product_id=p.id)
            db.add(cs)
        
        db.commit(); db.refresh(p)
        return serialize_product(p)
    except Exception as e:
        print(f"Error in create_product: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/products/{id}")
def update_product(id: int, data: dict, db: Session = Depends(get_db)):
    try:
        comps = data.pop("component_serials", [])
        p = db.query(Product).filter(Product.id == id).first()
        if not p: raise HTTPException(404)
        
        valid_fields = ["title", "name", "serial_number", "warranty_period", "warranty_unit", "stage_id", "notes", "custom_data", "bom_id"]
        for k, v in data.items():
            if k in valid_fields: setattr(p, k, v)
            
        # Convert empty serial_number to None to avoid unique constraint clash when empty
        if not p.serial_number:
            p.serial_number = None

        # Default title to BOM name if title is empty
        if not p.title and p.bom_id:
            bom = db.query(BOM).filter(BOM.id == p.bom_id).first()
            if bom: p.title = bom.name
        
        # Sync components
        db.query(ProductComponentSerial).filter(ProductComponentSerial.product_id == id).delete()
        for c in comps:
            cs_data = {k: v for k, v in c.items() if k in ["bom_component_id", "serial_number", "warranty_period", "warranty_unit"]}
            cs = ProductComponentSerial(**cs_data, product_id=p.id)
            db.add(cs)
        
        db.commit(); db.refresh(p)
        return serialize_product(p)
    except Exception as e:
        print(f"Error in update_product: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

def serialize_bom(b: BOM):
    return {
        "id": b.id,
        "name": b.name,
        "description": b.description,
        "warranty_period": b.warranty_period,
        "warranty_unit": b.warranty_unit,
        "created_at": str(b.created_at),
        "components": [{
            "id": c.id,
            "name": c.name,
            "part_number": c.part_number,
            "quantity": c.quantity,
            "warranty_period": c.warranty_period,
            "warranty_unit": c.warranty_unit,
            "sort_order": c.sort_order
        } for c in sorted(b.components, key=lambda x: x.sort_order)]
    }

@router.get("/boms")
def get_boms(db: Session = Depends(get_db)):
    boms = db.query(BOM).all()
    return [serialize_bom(b) for b in boms]

@router.get("/boms/{id}")
def get_bom(id: int, db: Session = Depends(get_db)):
    b = db.query(BOM).filter(BOM.id == id).first()
    if not b: raise HTTPException(404)
    return serialize_bom(b)

@router.post("/boms")
def create_bom(data: dict, db: Session = Depends(get_db)):
    comps = data.pop("components", [])
    b = BOM(**data)
    db.add(b); db.commit(); db.refresh(b)
    for c in comps:
        comp = BOMComponent(**c, bom_id=b.id)
        db.add(comp)
    db.commit(); db.refresh(b)
    return serialize_bom(b)

@router.put("/boms/{id}")
def update_bom(id: int, data: dict, db: Session = Depends(get_db)):
    comps = data.pop("components", [])
    b = db.query(BOM).filter(BOM.id == id).first()
    if not b: raise HTTPException(404)
    for k, v in data.items(): setattr(b, k, v)
    
    # Simple sync: remove old and re-add new
    db.query(BOMComponent).filter(BOMComponent.bom_id == id).delete()
    for c in comps:
        c.pop("id", None) # remove id if exists to create new
        comp = BOMComponent(**c, bom_id=b.id)
        db.add(comp)
    
    db.commit(); db.refresh(b)
    return serialize_bom(b)
