from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
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
    q = db.query(Lead)
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

@router.post("/leads")
def create_lead(data: LeadIn, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    ref = next_sequence(db, "crm")
    lead = Lead(**data.model_dump(), reference=ref, created_by=current_user.id)
    db.add(lead); db.commit(); db.refresh(lead)
    log_action(db, current_user, "CREATE", "crm", lead.id, ref, {"created_by": current_user.name})
    return serialize_lead(lead)

@router.get("/leads/{lid}")
def get_lead(lid: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    l = db.query(Lead).filter(Lead.id == lid).first()
    if not l: raise HTTPException(404, "Not found")
    data = serialize_lead(l)
    data["activities"] = [
        {"id": a.id, "type": a.activity_type, "description": a.description,
         "done": a.done, "due_date": str(a.due_date) if a.due_date else None,
         "created_at": str(a.created_at)}
        for a in sorted(l.activities, key=lambda x: x.created_at, reverse=True)
    ]
    # fetch change logs for this lead
    logs = db.query(AuditLog).filter(
        AuditLog.module == "crm", AuditLog.record_id == lid
    ).order_by(AuditLog.created_at.desc()).limit(50).all()
    data["change_logs"] = [
        {"id": lg.id, "action": lg.action, "user_name": getattr(lg, 'user_name', None) or (lg.user.name if lg.user else ""),
         "changes": lg.changes, "created_at": str(lg.created_at)}
        for lg in logs
    ]
    return data

@router.put("/leads/{lid}")
def update_lead(lid: int, data: LeadIn, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    l = db.query(Lead).filter(Lead.id == lid).first()
    if not l: raise HTTPException(404, "Not found")
    changes = get_lead_changes(l, data.model_dump(), db)
    for k, v in data.model_dump().items(): setattr(l, k, v)
    db.commit(); db.refresh(l)
    if changes:
        log_action(db, current_user, "UPDATE", "crm", l.id, l.reference, changes)
    return serialize_lead(l)

@router.put("/leads/{lid}/stage")
def update_stage(lid: int, data: StageUpdateIn, db: Session = Depends(get_db), current_user=Depends(require_admin)):
    l = db.query(Lead).filter(Lead.id == lid).first()
    if not l: raise HTTPException(404, "Not found")
    old_stage = db.query(Stage).filter(Stage.id == l.stage_id).first()
    new_stage = db.query(Stage).filter(Stage.id == data.stage_id).first()
    l.stage_id = data.stage_id
    db.commit(); db.refresh(l)
    log_action(db, current_user, "UPDATE", "crm", l.id, l.reference, {
        "stage": {"from": old_stage.name if old_stage else None, "to": new_stage.name if new_stage else None}
    })
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
    log_action(db, current_user, "ACTIVITY", "crm", data.lead_id, "", {
        "type": data.activity_type, "description": data.description
    })
    return {"id": a.id, "type": a.activity_type, "description": a.description,
            "due_date": str(a.due_date) if a.due_date else None, "done": a.done,
            "created_at": str(a.created_at)}

@router.put("/activities/{aid}/done")
def mark_done(aid: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    a = db.query(Activity).filter(Activity.id == aid).first()
    if not a: raise HTTPException(404, "Not found")
    a.done = True; db.commit()
    return {"message": "Done"}

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
        ws.append([l.reference, l.title, l.customer_name, l.stage.name if l.stage else "",
                   l.expected_revenue, l.assignee.name if l.assignee else "", str(l.created_at)])
    buf = io.BytesIO(); wb.save(buf); buf.seek(0)
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": "attachment; filename=leads.xlsx"})

# ── CRM Dashboard ─────────────────────────────────────────────
@router.get("/dashboard")
def crm_dashboard(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    from app.models import Stage, Activity, CRMActivityType
    from datetime import date, timedelta, datetime
    from sqlalchemy import cast, Date

    stages = db.query(Stage).filter(Stage.module == "crm").order_by(Stage.sort_order).all()
    stage_counts = []
    for s in stages:
        count = db.query(Lead).filter(Lead.stage_id == s.id).count()
        stage_counts.append({"id": s.id, "name": s.name, "color": s.color, "count": count})

    today = date.today()
    tomorrow = today + timedelta(days=1)

    # parse date range
    try:
        range_from = datetime.strptime(date_from, "%Y-%m-%d").date() if date_from else None
        range_to = datetime.strptime(date_to, "%Y-%m-%d").date() if date_to else None
    except:
        range_from = range_to = None

    # build day list: if range given use range, else today+tomorrow
    if range_from and range_to:
        delta = (range_to - range_from).days + 1
        days = [(range_from + timedelta(days=i)) for i in range(min(delta, 14))]
        day_pairs = [(str(d), d) for d in days]
    else:
        day_pairs = [("today", today), ("tomorrow", tomorrow)]

    try:
        act_types_q = db.query(CRMActivityType).filter(CRMActivityType.is_active == True).order_by(CRMActivityType.sort_order).all()
        type_names = [t.name for t in act_types_q] if act_types_q else ["note", "call", "follow-up"]
    except:
        type_names = ["note", "call", "follow-up"]

    def count_activities(day, act_type, user_id=None):
        try:
            q = db.query(Activity).filter(
                Activity.done == False,
                cast(Activity.due_date, Date) == day,
                Activity.activity_type == act_type
            )
            if user_id:
                q = q.filter(Activity.created_by == user_id)
            return q.count()
        except: return 0

    activity_grid = {}
    for day_label, day in day_pairs:
        activity_grid[day_label] = {}
        for t in type_names:
            activity_grid[day_label][t] = {
                "mine": count_activities(day, t, current_user.id),
                "all": count_activities(day, t)
            }

    return {
        "stage_counts": stage_counts,
        "activity_grid": activity_grid,
        "activity_types": type_names,
        "day_labels": [d[0] for d in day_pairs],
    }

# ── Activity Types (admin) ────────────────────────────────────
@router.get("/activity-types")
def get_activity_types(db: Session = Depends(get_db), _=Depends(get_current_user)):
    from app.models import CRMActivityType
    types = db.query(CRMActivityType).filter(CRMActivityType.is_active == True).order_by(CRMActivityType.sort_order).all()
    if not types:
        return [
            {"id": None, "name": "note", "color": "#6366f1", "icon": "📝"},
            {"id": None, "name": "call", "color": "#22c55e", "icon": "📞"},
            {"id": None, "name": "follow-up", "color": "#f59e0b", "icon": "🔔"},
        ]
    return [{"id": t.id, "name": t.name, "color": t.color, "icon": t.icon} for t in types]

@router.post("/activity-types")
def create_activity_type(data: dict, db: Session = Depends(get_db), _=Depends(require_admin)):
    from app.models import CRMActivityType
    t = CRMActivityType(**data); db.add(t); db.commit(); db.refresh(t)
    return {"id": t.id, "name": t.name, "color": t.color, "icon": t.icon}

@router.put("/activity-types/{tid}")
def update_activity_type(tid: int, data: dict, db: Session = Depends(get_db), _=Depends(require_admin)):
    from app.models import CRMActivityType
    t = db.query(CRMActivityType).filter(CRMActivityType.id == tid).first()
    if not t: raise HTTPException(404, "Not found")
    for k, v in data.items(): setattr(t, k, v)
    db.commit(); db.refresh(t)
    return {"id": t.id, "name": t.name, "color": t.color, "icon": t.icon}

@router.delete("/activity-types/{tid}")
def delete_activity_type(tid: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    from app.models import CRMActivityType
    t = db.query(CRMActivityType).filter(CRMActivityType.id == tid).first()
    if not t: raise HTTPException(404, "Not found")
    t.is_active = False; db.commit()
    return {"message": "Deleted"}
