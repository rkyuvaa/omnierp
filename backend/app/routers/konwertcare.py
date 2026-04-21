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
    
    # Installation count (for Vehicle Delivery tile)
    inst_count = db.query(Installation).count()
    
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
    
    total = q.count()
    tickets = q.order_by(KonwertCareTicket.id.desc()).offset(skip).limit(limit).all()
    return {"total": total, "items": [serialize(t) for t in tickets]}

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
        
    # 1. Update Warranty Module (ProductComponentSerial)
    serial = db.query(ProductComponentSerial).filter(ProductComponentSerial.serial_number == t.product_serial).first()
    if serial:
        serial.warranty_status = 'active'
        # Record activation date in serial's custom_data if needed
        scustom = serial.custom_data or {}
        scustom['warranty_start_date'] = datetime.now().isoformat()
        serial.custom_data = scustom
    
    # 2. Update Care Ticket
    custom['warranty_status'] = 'Active'
    custom['warranty_activated_at'] = datetime.now().isoformat()
    t.custom_data = custom
    
    db.commit(); db.refresh(t)
    return serialize(t)

@router.delete("/{id}")
def delete_ticket(id: int, db: Session = Depends(get_db)):
    t = db.query(KonwertCareTicket).filter(KonwertCareTicket.id == id).first()
    if not t: raise HTTPException(404)
    db.delete(t)
    db.commit()
    return {"message": "Deleted"}
