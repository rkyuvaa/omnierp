from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from pydantic import BaseModel
from typing import Optional
from .studio import get_stages
from app.database import get_db
from app.models import Lead, Activity, Customer, Stage, AuditLog
from app.auth import get_current_user, require_admin, log_action, next_sequence
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

class StageUpdateIn(BaseModel):
    stage_id: Optional[int] = None

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

def get_lead_changes(old: Lead, new_data: dict, db: Session) -> dict:
    changes = {}
    simple = ['title', 'customer_name', 'email', 'phone', 'assigned_to']
    for field in simple:
        old_val = getattr(old, field)
        new_val = new_data.get(field)
        if str(old_val or '') != str(new_val or ''):
            changes[field] = {'from': old_val, 'to': new_val}
    # stage
    if old.stage_id != new_data.get('stage_id'):
        old_stage = db.query(Stage).filter(Stage.id == old.stage_id).first()
        new_stage = db.query(Stage).filter(Stage.id == new_data.get('stage_id')).first()
        changes['stage'] = {
            'from': old_stage.name if old_stage else None,
            'to': new_stage.name if new_stage else None
        }
    # custom_data
    old_custom = old.custom_data or {}
    new_custom = new_data.get('custom_data', {})
    for k in set(list(old_custom.keys()) + list(new_custom.keys())):
        if str(old_custom.get(k, '')) != str(new_custom.get(k, '')):
            changes[f'custom:{k}'] = {'from': old_custom.get(k), 'to': new_custom.get(k)}
    return changes

@router.get("/leads")
def list_leads(
    search: Optional[str] = None, stage_id: Optional[int] = None,
    assigned_to: Optional[int] = None, skip: int = 0, limit: int = 50,
    activity_type: Optional[str] = None, activity_day: Optional[str] = None,
    db: Session = Depends(get_db), current_user=Depends(get_current_user)
):
    q = db.query(Lead).options(joinedload(Lead.stage), joinedload(Lead.assignee))
    if search:
        q = q.filter(or_(Lead.title.ilike(f"%{search}%"), Lead.customer_name.ilike(f"%{search}%")))
    if stage_id: q = q.filter(Lead.stage_id == stage_id)
    if assigned_to: q = q.filter(Lead.assigned_to == assigned_to)
    if activity_type and activity_day:
        from datetime import date, timedelta
        from sqlalchemy import cast, Date
        day = date.today() if activity_day == "today" else date.today() + timedelta(days=1)
        lead_ids = db.query(Activity.lead_id).filter(
            Activity.activity_type == activity_type,
            Activity.done == False,
            cast(Activity.due_date, Date) == day
        ).subquery()
        q = q.filter(Lead.id.in_(lead_ids))
    total = q.count()
    leads = q.order_by(Lead.id.desc()).offset(skip).limit(limit).all()
    return {"total": total, "items": [serialize_lead(l) for l in leads]}
