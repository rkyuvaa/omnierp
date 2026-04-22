from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func, Date, cast
from pydantic import BaseModel
from typing import Optional, List
from app.database import get_db
from app.models import Lead, Activity, Customer, Stage, AuditLog
from app.auth import get_current_user, require_admin, log_action, next_sequence
import io
from fastapi.responses import StreamingResponse
import openpyxl
from datetime import date, timedelta

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

class ActivityTypeIn(BaseModel):
    name: str
    icon: str = "📝"
    color: str = "#6366f1"
    sort_order: int = 0

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
    if old.stage_id != new_data.get('stage_id'):
        old_stage = db.query(Stage).filter(Stage.id == old.stage_id).first()
        new_stage = db.query(Stage).filter(Stage.id == new_data.get('stage_id')).first()
        changes['stage'] = {
            'from': old_stage.name if old_stage else None,
            'to': new_stage.name if new_stage else None
        }
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
        # Use trigram indexing advantage by filtering with ilike (which the indexes optimize)
        from sqlalchemy import cast, String
        q = q.filter(or_(
            Lead.title.ilike(f"%{search}%"), 
            Lead.customer_name.ilike(f"%{search}%"), 
            Lead.reference.ilike(f"%{search}%")
        ))
    if stage_id: q = q.filter(Lead.stage_id == stage_id)
    if assigned_to: q = q.filter(Lead.assigned_to == assigned_to)
    if activity_type and activity_day:
        day = date.today() if activity_day == "today" else date.today() + timedelta(days=1)
        lead_ids = db.query(Activity.lead_id).filter(
            Activity.activity_type == activity_type,
            Activity.done == False,
            cast(Activity.due_date, Date) == day
        ).subquery()
        q = q.filter(Lead.id.in_(lead_ids))
    total = q.count()
    items = q.order_by(Lead.id.desc()).offset(skip).limit(limit).all()
    return {"total": total, "items": [serialize_lead(l) for l in items]}

@router.post("/leads")
def create_lead(data: LeadIn, db: Session = Depends(get_db), cu=Depends(get_current_user)):
    ref = next_sequence(db, "crm")
    l = Lead(**data.model_dump(), reference=ref, created_by=cu.id)
    db.add(l); db.commit(); db.refresh(l)
    log_action(db, cu, "CREATE", "crm", l.id, ref)
    return serialize_lead(l)

@router.get("/leads/{lid}")
def get_lead(lid: int, db: Session = Depends(get_db), cu=Depends(get_current_user)):
    l = db.query(Lead).options(joinedload(Lead.stage), joinedload(Lead.assignee)).filter(Lead.id == lid).first()
    if not l: raise HTTPException(404, "Not found")
    activities = db.query(Activity).filter(Activity.lead_id == lid).order_by(Activity.id.desc()).all()
    logs = db.query(AuditLog).filter(AuditLog.module == "crm", AuditLog.record_id == lid).order_by(AuditLog.id.desc()).all()
    res = serialize_lead(l)
    res["activities"] = [{"id": a.id, "activity_type": a.activity_type, "description": a.description, "due_date": str(a.due_date), "done": a.done, "created_at": str(a.created_at)} for a in activities]
    res["change_logs"] = [{"id": g.id, "action": g.action, "changes": g.changes, "user": g.user.name if g.user else "System", "created_at": str(g.created_at)} for g in logs]
    return res

@router.get("/leads/{lid}/navigation")
def get_lead_navigation(lid: int, db: Session = Depends(get_db)):
    prev_id = db.query(Lead.id).filter(Lead.id < lid).order_by(Lead.id.desc()).first()
    next_id = db.query(Lead.id).filter(Lead.id > lid).order_by(Lead.id.asc()).first()
    return {
        "prev": prev_id[0] if prev_id else None,
        "next": next_id[0] if next_id else None
    }

@router.put("/leads/{lid}")
def update_lead(lid: int, data: LeadIn, db: Session = Depends(get_db), cu=Depends(get_current_user)):
    l = db.query(Lead).filter(Lead.id == lid).first()
    if not l: raise HTTPException(404)
    changes = get_lead_changes(l, data.model_dump(), db)
    if changes:
        log_action(db, cu, "UPDATE", "crm", l.id, l.reference, str(changes))
    for k, v in data.model_dump().items(): setattr(l, k, v)
    db.commit(); db.refresh(l); return serialize_lead(l)

@router.delete("/leads/{lid}")
def delete_lead(lid: int, db: Session = Depends(get_db), cu=Depends(get_current_user)):
    l = db.query(Lead).filter(Lead.id == lid).first()
    if not l: raise HTTPException(404)
    db.delete(l); db.commit(); return {"message": "Deleted"}

@router.put("/leads/{lid}/stage")
def update_lead_stage(lid: int, data: StageUpdateIn, db: Session = Depends(get_db), cu=Depends(get_current_user)):
    l = db.query(Lead).filter(Lead.id == lid).first()
    if not l: raise HTTPException(404)
    old_stage = db.query(Stage).filter(Stage.id == l.stage_id).first()
    new_stage = db.query(Stage).filter(Stage.id == data.stage_id).first()
    l.stage_id = data.stage_id
    log_action(db, cu, "STAGE_CHANGE", "crm", l.id, l.reference, f"Stage moved from {old_stage.name if old_stage else 'None'} to {new_stage.name if new_stage else 'None'}")
    db.commit(); return serialize_lead(l)

@router.get("/dashboard")
def crm_dashboard(date_from: Optional[str] = None, date_to: Optional[str] = None, db: Session = Depends(get_db), cu=Depends(get_current_user)):
    stages = db.query(Stage).filter(Stage.module == "crm").order_by(Stage.sort_order).all()
    stage_counts = []
    for s in stages:
        count = db.query(Lead).filter(Lead.stage_id == s.id).count()
        stage_counts.append({"id": s.id, "name": s.name, "color": s.color, "count": count})
    
    # Activity grid logic
    act_types = ["call", "meeting", "email", "task"]
    day_labels = ["today", "tomorrow"]
    grid = {}
    for day in day_labels:
        d = date.today() if day == "today" else date.today() + timedelta(days=1)
        grid[day] = {}
        for t in act_types:
            q = db.query(Activity).filter(Activity.activity_type == t, Activity.done == False, cast(Activity.due_date, Date) == d)
            all_count = q.count()
            # For "mine", we filter by leads assigned to current user
            mine_count = q.join(Lead).filter(Lead.assigned_to == cu.id).count()
            grid[day][t] = {"mine": mine_count, "all": all_count}
    
    return {
        "stage_counts": stage_counts,
        "activity_types": act_types,
        "activity_grid": grid,
        "day_labels": day_labels
    }

@router.post("/activities")
def create_activity(data: ActivityIn, db: Session = Depends(get_db), cu=Depends(get_current_user)):
    a = Activity(**data.model_dump())
    db.add(a); db.commit(); db.refresh(a); return a

@router.put("/activities/{aid}/done")
def mark_activity_done(aid: int, db: Session = Depends(get_db), cu=Depends(get_current_user)):
    a = db.query(Activity).filter(Activity.id == aid).first()
    if not a: raise HTTPException(404)
    a.done = True; db.commit(); return {"message": "Done"}

@router.get("/activity-types")
def list_activity_types(db: Session = Depends(get_db), _=Depends(get_current_user)):
    from app.models import CRMActivityType
    return db.query(CRMActivityType).filter(CRMActivityType.is_active == True).order_by(CRMActivityType.sort_order).all()

@router.post("/activity-types")
def create_activity_type(data: ActivityTypeIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    from app.models import CRMActivityType
    t = CRMActivityType(**data.model_dump())
    db.add(t); db.commit(); db.refresh(t); return t

@router.delete("/activity-types/{tid}")
def delete_activity_type(tid: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    from app.models import CRMActivityType
    t = db.query(CRMActivityType).filter(CRMActivityType.id == tid).first()
    if not t: raise HTTPException(404)
    t.is_active = False; db.commit(); return {"message": "Deleted"}

@router.get("/leads/export/excel")
def export_leads(db: Session = Depends(get_db), cu=Depends(get_current_user)):
    leads = db.query(Lead).options(joinedload(Lead.stage), joinedload(Lead.assignee)).all()
    wb = openpyxl.Workbook(); ws = wb.active
    ws.append(["Reference", "Title", "Customer", "Email", "Phone", "Stage", "Assignee", "Revenue", "Created"])
    for l in leads:
        ws.append([l.reference, l.title, l.customer_name, l.email, l.phone, l.stage.name if l.stage else "", l.assignee.name if l.assignee else "", l.expected_revenue, str(l.created_at)])
    buf = io.BytesIO(); wb.save(buf); buf.seek(0)
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": "attachment; filename=leads.xlsx"})
