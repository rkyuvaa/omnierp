from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from ..database import get_db
from ..models import KonwertCareTicket, ProductComponentSerial, Stage
from datetime import datetime
from ..auth import get_current_user
from typing import Optional, List
from sqlalchemy import or_

router = APIRouter()

def serialize(r: KonwertCareTicket):
    return {
        "id": r.id,
        "reference": r.reference,
        "customer_name": r.customer_name,
        "phone": r.phone,
        "email": r.email,
        "vehicle_number": r.vehicle_number,
        "vehicle_make": r.vehicle_make,
        "vehicle_model": r.vehicle_model,
        "product_serial": r.product_serial,
        "issue_type": r.issue_type,
        "issue_description": r.issue_description,
        "stage_id": r.stage_id,
        "stage_name": r.stage.name if r.stage else None,
        "stage_color": r.stage.color if r.stage else None,
        "notes": r.notes,
        "custom_data": r.custom_data or {},
        "created_at": str(r.created_at)
    }

@router.get("/summary")
def get_summary(db: Session = Depends(get_db)):
    from sqlalchemy import func
    from ..models import Installation
    
    # Care Ticket counts
    results = db.query(KonwertCareTicket.issue_type, func.count(KonwertCareTicket.id)).group_by(KonwertCareTicket.issue_type).all()
    counts = {r[0]: r[1] for r in results}
    
    # Installation count (for Vehicle Delivery tile - filtered to only delivery stages)
    delivery_stages = ["Fitment Done", "Customer Delivery", "RTO Process", "HSRP"]
    inst_count = db.query(Installation).join(Stage).filter(func.upper(func.trim(Stage.name)).in_([n.upper() for n in delivery_stages])).count()
    
    return {
        "service": counts.get("Service", 0),
        "maintenance": counts.get("Maintenance", 0),
        "vehicle_delivery": inst_count,
        "total": sum(counts.values()) + inst_count
    }

@router.get("/")
def list_tickets(
    search: Optional[str] = None, 
    issue_type: Optional[str] = None,
    skip: int = 0, 
    limit: int = 50, 
    db: Session = Depends(get_db)
):
    try:
        from sqlalchemy import func
        from ..models import Product, Stage
        import datetime
        
        # 1. Background Check for Expiry (Automatic Stage Transition)
        now = datetime.date.today()
        expired_stage = db.query(Stage).filter(Stage.module == 'konwertcare', Stage.name.ilike('%warranty expire%')).first()
        if expired_stage:
            # Find tickets with products that have expired
            # We join with Product to check the date
            tickets_to_update = db.query(KonwertCareTicket).join(
                Product, KonwertCareTicket.product_serial == Product.serial_number
            ).filter(
                Product.warranty_end_date < now,
                KonwertCareTicket.stage_id != expired_stage.id
            ).all()
            
            for t in tickets_to_update:
                t.stage_id = expired_stage.id
            if tickets_to_update:
                db.commit()

        q = db.query(KonwertCareTicket).options(joinedload(KonwertCareTicket.stage))
        
        if search:
            q = q.filter(or_(
                KonwertCareTicket.customer_name.ilike(f"%{search}%"),
                KonwertCareTicket.reference.ilike(f"%{search}%"),
                KonwertCareTicket.vehicle_number.ilike(f"%{search}%"),
                KonwertCareTicket.phone.ilike(f"%{search}%")
            ))
        
        if issue_type:
            q = q.filter(KonwertCareTicket.issue_type == issue_type)
        
        # Calculate stage counts for the ribbon
        count_q = db.query(KonwertCareTicket.stage_id, func.count(KonwertCareTicket.id)).group_by(KonwertCareTicket.stage_id)
        if search:
            count_q = count_q.filter(or_(
                KonwertCareTicket.customer_name.ilike(f"%{search}%"),
                KonwertCareTicket.reference.ilike(f"%{search}%"),
                KonwertCareTicket.vehicle_number.ilike(f"%{search}%"),
                KonwertCareTicket.phone.ilike(f"%{search}%")
            ))
        if issue_type:
            count_q = count_q.filter(KonwertCareTicket.issue_type == issue_type)
        
        counts_res = count_q.all()
        stage_counts = {r[0]: r[1] for r in counts_res if r[0] is not None}

        total = q.count()
        tickets = q.order_by(KonwertCareTicket.id.desc()).offset(skip).limit(limit).all()
        return {
            "total": total, 
            "items": [serialize(t) for t in tickets],
            "stage_counts": stage_counts
        }
    except Exception as e:
        import traceback
        print(f"DEBUG: list_tickets ERROR: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{id}")
def get_ticket(id: int, db: Session = Depends(get_db)):
    t = db.query(KonwertCareTicket).options(joinedload(KonwertCareTicket.stage)).filter(KonwertCareTicket.id == id).first()
    if not t: raise HTTPException(404)
    return serialize(t)

@router.get("/{id}/navigation")
def get_ticket_navigation(id: int, db: Session = Depends(get_db)):
    prev_id = db.query(KonwertCareTicket.id).filter(KonwertCareTicket.id < id).order_by(KonwertCareTicket.id.desc()).first()
    next_id = db.query(KonwertCareTicket.id).filter(KonwertCareTicket.id > id).order_by(KonwertCareTicket.id.asc()).first()
    return {
        "prev": prev_id[0] if prev_id else None,
        "next": next_id[0] if next_id else None
    }

@router.post("/")
def create_ticket(data: dict, db: Session = Depends(get_db), cu=Depends(get_current_user)):
    try:
        import datetime
        last = db.query(KonwertCareTicket).order_by(KonwertCareTicket.id.desc()).first()
        next_id = (last.id + 1) if last else 1
        ref = f"CARE/{datetime.datetime.now().year}/{next_id:04d}"
        
        # Map and filter fields to match the model
        staff_id = data.pop('assigned_to', None)
        if staff_id: data['staff_id'] = staff_id
        
        # Filter valid fields for KonwertCareTicket
        valid_fields = [
            'customer_name', 'phone', 'email', 'vehicle_number', 'product_serial',
            'vehicle_make', 'vehicle_model', 'issue_type', 'issue_description',
            'stage_id', 'staff_id', 'notes', 'custom_data'
        ]
        creation_data = {k: v for k, v in data.items() if k in valid_fields}
        
        t = KonwertCareTicket(**creation_data, reference=ref, created_by=cu.id)
        
        # Default stage to 'New' if not set
        if not t.stage_id:
            new_stage = db.query(Stage).filter(Stage.module == 'konwertcare', Stage.name.ilike('%new%')).first()
            if new_stage:
                t.stage_id = new_stage.id
                
        db.add(t)
        db.commit()
        db.refresh(t)
        return serialize(t)
    except Exception as e:
        db.rollback()
        print(f"DEBUG: Create Ticket Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{id}")
def update_ticket(id: int, data: dict, db: Session = Depends(get_db)):
    t = db.query(KonwertCareTicket).filter(KonwertCareTicket.id == id).first()
    if not t: raise HTTPException(404)
    
    # Map and filter fields
    staff_id = data.pop('assigned_to', None)
    if staff_id: data['staff_id'] = staff_id
    
    valid_fields = [
        'customer_name', 'phone', 'email', 'vehicle_number', 'product_serial',
        'vehicle_make', 'vehicle_model', 'issue_type', 'issue_description',
        'stage_id', 'staff_id', 'notes', 'custom_data'
    ]
    
    for k, v in data.items():
        if k in valid_fields: setattr(t, k, v)
        
    db.commit(); db.refresh(t)
    return serialize(t)

@router.post("/{id}/activate")
def activate_warranty(id: int, db: Session = Depends(get_db)):
    t = db.query(KonwertCareTicket).filter(KonwertCareTicket.id == id).first()
    if not t: raise HTTPException(404, "Ticket not found")
    
    if not t.product_serial:
        raise HTTPException(400, "No product serial associated with this record")
        
    # Check if already activated
    custom = t.custom_data or {}
    if custom.get('warranty_status') == 'Active':
        return serialize(t)
        
    from ..models import Product
    import datetime
    
    # 1. Update Warranty Module (Component Serials)
    serials = db.query(ProductComponentSerial).filter(ProductComponentSerial.serial_number == t.product_serial).all()
    now = datetime.datetime.now()
    for s in serials:
        s.warranty_status = 'active'
        sc = s.custom_data or {}
        sc['warranty_start_date'] = now.isoformat()
        s.custom_data = sc
    
    # 2. Update Product (Vehicle) Root Record
    prod = db.query(Product).filter(Product.serial_number == t.product_serial).first()
    if prod:
        prod.warranty_start_date = now.date()
        # Calculate end date
        if prod.warranty_unit == 'years':
            try:
                prod.warranty_end_date = now.date().replace(year=now.year + (prod.warranty_period or 0))
            except ValueError: # Handle Feb 29
                prod.warranty_end_date = now.date().replace(year=now.year + (prod.warranty_period or 0), day=28)
        else:
            # Advance months
            month = now.month - 1 + (prod.warranty_period or 0)
            year = now.year + month // 12
            month = month % 12 + 1
            day = min(now.day, [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month-1])
            prod.warranty_end_date = datetime.date(year, month, day)

    # 3. Update Care Ticket
    custom['warranty_status'] = 'Active'
    custom['warranty_activated_at'] = now.isoformat()
    if prod:
        custom['warranty_expires_at'] = prod.warranty_end_date.isoformat() if prod.warranty_end_date else None
    
    t.custom_data = custom
    
    # 4. Set Stage to 'On Warranty' (Dynamic Name Match)
    target_stage = db.query(Stage).filter(Stage.module == 'konwertcare', Stage.name.ilike('%on warranty%')).first()
    if target_stage:
        t.stage_id = target_stage.id
    
    db.commit(); db.refresh(t)
    return serialize(t)

@router.delete("/{id}")
def delete_ticket(id: int, db: Session = Depends(get_db)):
    t = db.query(KonwertCareTicket).filter(KonwertCareTicket.id == id).first()
    if not t: raise HTTPException(404)
    db.delete(t)
    db.commit()
    return {"message": "Deleted"}
