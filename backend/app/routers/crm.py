from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models import Lead, Activity, Customer, Stage
from app.auth import get_current_user, log_action, next_sequence
import io
from fastapi.responses import StreamingResponse
import openpyxl

router = APIRouter()

class LeadIn(BaseModel):
    title: str
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    stage_id: Optional[int] = None
    assigned_to: Optional[int] = None
    expected_revenue: float = 0
    notes: Optional[str] = None
    custom_data: dict = {}

class ActivityIn(BaseModel):
    lead_id: int
    activity_type: str
    description: str
    due_date: Optional[str] = None

def serialize_lead(l: Lead):
    return {
        "id": l.id, "reference": l.reference, "title": l.title,
        "customer_id": l.customer_id, "customer_name": l.customer_name,
        "email": l.email, "phone": l.phone, "stage_id": l.stage_id,
        "assigned_to": l.assigned_to, "expected_revenue": l.expected_revenue,
        "notes": l.notes, "custom_data": l.custom_data or {},
        "created_at": str(l.created_at),
        "stage_name": l.stage.name if l.stage else None,
        "stage_color": l.stage.color if l.stage else None,
        "assignee_name": l.assignee.name if l.assignee else None,
    }

@router.get("/leads")
def list_leads(
    search: Optional[str] = None, stage_id: Optional[int] = None,
    assigned_to: Optional[int] = None, skip: int = 0, limit: int = 50,
    db: Session = Depends(get_db), current_user=Depends(get_current_user)
):
    q = db.query(Lead)
    if search:
        q = q.filter(or_(Lead.title.ilike(f"%{search}%"), Lead.customer_name.ilike(f"%{search}%")))
    if stage_id: q = q.filter(Lead.stage_id == stage_id)
    if assigned_to: q = q.filter(Lead.assigned_to == assigned_to)
    total = q.count()
    leads = q.order_by(Lead.id.desc()).offset(skip).limit(limit).all()
    return {"total": total, "items": [serialize_lead(l) for l in leads]}

@router.post("/leads")
def create_lead(data: LeadIn, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    ref = next_sequence(db, "crm")
    lead = Lead(**data.model_dump(), reference=ref, created_by=current_user.id)
    db.add(lead); db.commit(); db.refresh(lead)
    log_action(db, current_user, "CREATE", "crm", lead.id, ref)
    return serialize_lead(lead)

@router.get("/leads/{lid}")
def get_lead(lid: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    l = db.query(Lead).filter(Lead.id == lid).first()
    if not l: raise HTTPException(404, "Not found")
    data = serialize_lead(l)
    data["activities"] = [{"id": a.id, "type": a.activity_type, "description": a.description, "done": a.done, "created_at": str(a.created_at)} for a in l.activities]
    return data

@router.put("/leads/{lid}")
def update_lead(lid: int, data: LeadIn, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    l = db.query(Lead).filter(Lead.id == lid).first()
    if not l: raise HTTPException(404, "Not found")
    for k, v in data.model_dump().items(): setattr(l, k, v)
    db.commit(); db.refresh(l)
    log_action(db, current_user, "UPDATE", "crm", l.id, l.reference)
    return serialize_lead(l)

@router.delete("/leads/{lid}")
def delete_lead(lid: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    l = db.query(Lead).filter(Lead.id == lid).first()
    if not l: raise HTTPException(404, "Not found")
    db.delete(l); db.commit()
    return {"message": "Deleted"}

@router.post("/activities")
def create_activity(data: ActivityIn, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    a = Activity(**data.model_dump(), created_by=current_user.id)
    db.add(a); db.commit(); db.refresh(a)
    return {"id": a.id, "type": a.activity_type, "description": a.description}

@router.put("/activities/{aid}/done")
def mark_done(aid: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    a = db.query(Activity).filter(Activity.id == aid).first()
    if not a: raise HTTPException(404, "Not found")
    a.done = True; db.commit(); return {"message": "Done"}

@router.get("/customers")
def list_customers(search: Optional[str] = None, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    q = db.query(Customer)
    if search:
        q = q.filter(or_(Customer.name.ilike(f"%{search}%"), Customer.email.ilike(f"%{search}%")))
    return q.order_by(Customer.id.desc()).limit(100).all()

@router.post("/customers")
def create_customer(data: dict, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    c = Customer(**data, created_by=current_user.id); db.add(c); db.commit(); db.refresh(c); return c

@router.get("/leads/export/excel")
def export_leads(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    leads = db.query(Lead).all()
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Reference", "Title", "Customer", "Stage", "Revenue", "Assignee", "Created"])
    for l in leads:
        ws.append([l.reference, l.title, l.customer_name, l.stage.name if l.stage else "", l.expected_revenue, l.assignee.name if l.assignee else "", str(l.created_at)])
    buf = io.BytesIO(); wb.save(buf); buf.seek(0)
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": "attachment; filename=leads.xlsx"})
