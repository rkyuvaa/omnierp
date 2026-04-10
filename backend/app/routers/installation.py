from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel
from typing import Optional
import io, openpyxl
from fastapi.responses import StreamingResponse
from app.database import get_db
from app.models import Installation
from app.auth import get_current_user, log_action, next_sequence

router = APIRouter()

class InstIn(BaseModel):
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    vehicle_number: Optional[str] = None
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None
    stage_id: Optional[int] = None
    technician_id: Optional[int] = None
    notes: Optional[str] = None
    custom_data: dict = {}

def serialize(r: Installation):
    return {
        "id": r.id, "reference": r.reference, "customer_name": r.customer_name,
        "vehicle_number": r.vehicle_number, "vehicle_make": r.vehicle_make,
        "vehicle_model": r.vehicle_model, "stage_id": r.stage_id,
        "technician_id": r.technician_id, "notes": r.notes,
        "custom_data": r.custom_data or {}, "created_at": str(r.created_at),
        "stage_name": r.stage.name if r.stage else None,
        "stage_color": r.stage.color if r.stage else None,
        "technician_name": r.technician.name if r.technician else None,
    }

@router.get("/")
def list_inst(search: Optional[str] = None, stage_id: Optional[int] = None, skip: int = 0, limit: int = 50, db: Session = Depends(get_db), cu=Depends(get_current_user)):
    q = db.query(Installation)
    if search: q = q.filter(or_(Installation.customer_name.ilike(f"%{search}%"), Installation.vehicle_number.ilike(f"%{search}%")))
    if stage_id: q = q.filter(Installation.stage_id == stage_id)
    total = q.count()
    items = q.order_by(Installation.id.desc()).offset(skip).limit(limit).all()
    return {"total": total, "items": [serialize(r) for r in items]}

@router.post("/")
def create_inst(data: InstIn, db: Session = Depends(get_db), cu=Depends(get_current_user)):
    ref = next_sequence(db, "installation")
    r = Installation(**data.model_dump(), reference=ref, created_by=cu.id)
    db.add(r); db.commit(); db.refresh(r)
    log_action(db, cu, "CREATE", "installation", r.id, ref)
    return serialize(r)

@router.get("/{rid}")
def get_inst(rid: int, db: Session = Depends(get_db), cu=Depends(get_current_user)):
    r = db.query(Installation).filter(Installation.id == rid).first()
    if not r: raise HTTPException(404, "Not found")
    return serialize(r)

@router.put("/{rid}")
def update_inst(rid: int, data: InstIn, db: Session = Depends(get_db), cu=Depends(get_current_user)):
    r = db.query(Installation).filter(Installation.id == rid).first()
    if not r: raise HTTPException(404, "Not found")
    for k, v in data.model_dump().items(): setattr(r, k, v)
    db.commit(); db.refresh(r)
    log_action(db, cu, "UPDATE", "installation", r.id, r.reference)
    return serialize(r)

@router.delete("/{rid}")
def delete_inst(rid: int, db: Session = Depends(get_db), cu=Depends(get_current_user)):
    r = db.query(Installation).filter(Installation.id == rid).first()
    if not r: raise HTTPException(404, "Not found")
    db.delete(r); db.commit(); return {"message": "Deleted"}

@router.get("/export/excel")
def export(db: Session = Depends(get_db), cu=Depends(get_current_user)):
    rows = db.query(Installation).all()
    wb = openpyxl.Workbook(); ws = wb.active
    ws.append(["Reference","Customer","Vehicle No","Make","Model","Stage","Technician","Created"])
    for r in rows:
        ws.append([r.reference, r.customer_name, r.vehicle_number, r.vehicle_make, r.vehicle_model, r.stage.name if r.stage else "", r.technician.name if r.technician else "", str(r.created_at)])
    buf = io.BytesIO(); wb.save(buf); buf.seek(0)
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": "attachment; filename=installations.xlsx"})
