from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func
from pydantic import BaseModel
from typing import Optional
from .studio import get_stages
import io, openpyxl
from fastapi.responses import StreamingResponse
from app.database import get_db
from app.models import CRMTab, Stage, CRMStageRule, CustomField, ServiceRequest
from app.auth import require_admin, get_current_user, log_action, next_sequence

router = APIRouter()

class SvcIn(BaseModel):
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    vehicle_number: Optional[str] = None
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None
    problem_description: Optional[str] = None
    stage_id: Optional[int] = None
    staff_id: Optional[int] = None
    notes: Optional[str] = None
    custom_data: dict = {}

def serialize(r: ServiceRequest):
    return {
        "id": r.id, "reference": r.reference, "customer_name": r.customer_name,
        "vehicle_number": r.vehicle_number, "vehicle_make": r.vehicle_make,
        "vehicle_model": r.vehicle_model, "problem_description": r.problem_description,
        "stage_id": r.stage_id, "staff_id": r.staff_id, "notes": r.notes,
        "custom_data": r.custom_data or {}, "created_at": str(r.created_at),
        "stage_name": r.stage.name if r.stage else None,
        "stage_color": r.stage.color if r.stage else None,
        "staff_name": r.staff.name if r.staff else None,
    }

@router.get("/")
def list_svc(search: Optional[str] = None, stage_id: Optional[int] = None, skip: int = 0, limit: int = 50, db: Session = Depends(get_db), cu=Depends(get_current_user)):
    q = db.query(ServiceRequest).options(joinedload(ServiceRequest.stage), joinedload(ServiceRequest.staff))
    if search: 
        q = q.filter(or_(
            ServiceRequest.customer_name.ilike(f"%{search}%"), 
            ServiceRequest.vehicle_number.ilike(f"%{search}%"),
            ServiceRequest.reference.ilike(f"%{search}%")
        ))

    # Stage counts based on filtered query (before pagination)
    stage_counts = {s_id: count for s_id, count in q.with_entities(ServiceRequest.stage_id, func.count(ServiceRequest.id)).group_by(ServiceRequest.stage_id).all() if s_id}
    
    if stage_id: q = q.filter(ServiceRequest.stage_id == stage_id)
    total = q.count()
    items = q.order_by(ServiceRequest.id.desc()).offset(skip).limit(limit).all()
    return {"total": total, "items": [serialize(r) for r in items], "stage_counts": stage_counts}

@router.post("/")
def create_svc(data: SvcIn, db: Session = Depends(get_db), cu=Depends(get_current_user)):
    ref = next_sequence(db, "service")
    r = ServiceRequest(**data.model_dump(), reference=ref, created_by=cu.id)
    db.add(r); db.commit(); db.refresh(r)
    log_action(db, cu, "CREATE", "service", r.id, ref)
    return serialize(r)

@router.get("/{rid}")
def get_svc(rid: int, db: Session = Depends(get_db), cu=Depends(get_current_user)):
    r = db.query(ServiceRequest).options(joinedload(ServiceRequest.stage), joinedload(ServiceRequest.staff)).filter(ServiceRequest.id == rid).first()
    if not r: raise HTTPException(404, "Not found")
    return serialize(r)

@router.get("/{rid}/navigation")
def get_service_navigation(rid: int, db: Session = Depends(get_db)):
    prev_id = db.query(ServiceRequest.id).filter(ServiceRequest.id < rid).order_by(ServiceRequest.id.desc()).first()
    next_id = db.query(ServiceRequest.id).filter(ServiceRequest.id > rid).order_by(ServiceRequest.id.asc()).first()
    return {
        "prev": prev_id[0] if prev_id else None,
        "next": next_id[0] if next_id else None
    }

@router.put("/{rid}")
def update_svc(rid: int, data: SvcIn, db: Session = Depends(get_db), cu=Depends(get_current_user)):
    r = db.query(ServiceRequest).filter(ServiceRequest.id == rid).first()
    if not r: raise HTTPException(404, "Not found")
    for k, v in data.model_dump().items(): setattr(r, k, v)
    db.commit(); db.refresh(r)
    log_action(db, cu, "UPDATE", "service", r.id, r.reference)
    return serialize(r)

@router.delete("/{rid}")
def delete_svc(rid: int, db: Session = Depends(get_db), cu=Depends(get_current_user)):
    r = db.query(ServiceRequest).filter(ServiceRequest.id == rid).first()
    if not r: raise HTTPException(404, "Not found")
    db.delete(r); db.commit(); return {"message": "Deleted"}

@router.get("/export/excel")
def export(db: Session = Depends(get_db), cu=Depends(get_current_user)):
    rows = db.query(ServiceRequest).options(joinedload(ServiceRequest.stage), joinedload(ServiceRequest.staff)).all()
    wb = openpyxl.Workbook(); ws = wb.active
    ws.append(["Reference","Customer","Vehicle No","Make","Model","Problem","Stage","Staff","Created"])
    for r in rows:
        ws.append([r.reference, r.customer_name, r.vehicle_number, r.vehicle_make, r.vehicle_model, r.problem_description, r.stage.name if r.stage else "", r.staff.name if r.staff else "", str(r.created_at)])
    buf = io.BytesIO(); wb.save(buf); buf.seek(0)
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": "attachment; filename=service.xlsx"})


from typing import Optional, List
from pydantic import BaseModel

class LayoutTabIn(BaseModel):
    name: str
    sort_order: int = 0

class LayoutFieldIn(BaseModel):
    tab_id: Optional[int] = None
    field_name: str
    field_label: str
    field_type: str
    placeholder: str = ""
    options: List[str] = []
    required: bool = False
    width: str = "full"
    visibility_rule: Optional[dict] = None
    sort_order: int = 0

class StageRuleIn(BaseModel):
    field_name: str
    stage_id: int
    condition_operator: str = "has_value"
    condition_value: Optional[str] = None

def ser_field(f):
    return {"id":f.id,"tab_id":f.tab_id,"field_name":f.field_name,"field_label":f.field_label,
            "field_type":f.field_type,"placeholder":f.placeholder or "","options":f.options or [],
            "required":f.required,"width":f.width or "full","visibility_rule":f.visibility_rule,"sort_order":f.sort_order}

@router.get("/layout/tabs")
def get_tabs(db: Session=Depends(get_db), _=Depends(get_current_user)):
    tabs = db.query(CRMTab).filter(CRMTab.is_active==True, CRMTab.module=="service").order_by(CRMTab.sort_order).all()
    result = []
    for t in tabs:
        fields = db.query(CustomField).filter(CustomField.tab_id==t.id, CustomField.is_active==True, CustomField.module=="service").order_by(CustomField.sort_order).all()
        result.append({"id":t.id,"name":t.name,"sort_order":t.sort_order, "fields":[ser_field(f) for f in fields],"module":"service"})
    return result

@router.post("/layout/tabs")
def create_tab(data: LayoutTabIn, db: Session=Depends(get_db), _=Depends(require_admin)):
    t = CRMTab(**data.model_dump(), module="service"); db.add(t); db.commit(); db.refresh(t)
    return {"id":t.id,"name":t.name,"sort_order":t.sort_order,"fields":[]}

@router.put("/layout/tabs/{tid}")
def update_tab(tid: int, data: LayoutTabIn, db: Session=Depends(get_db), _=Depends(require_admin)):
    t = db.query(CRMTab).filter(CRMTab.id==tid).first()
    if t: t.name=data.name; t.sort_order=data.sort_order; db.commit(); db.refresh(t)
    return {"id":t.id,"name":t.name,"sort_order":t.sort_order}

@router.delete("/layout/tabs/{tid}")
def delete_tab(tid: int, db: Session=Depends(get_db), _=Depends(require_admin)):
    t = db.query(CRMTab).filter(CRMTab.id==tid).first()
    if t: t.is_active=False; db.commit()
    return {"message":"Deleted"}

@router.get("/layout/fields")
def get_fields(db: Session=Depends(get_db), _=Depends(get_current_user)):
    fields = db.query(CustomField).filter(CustomField.module=="service",CustomField.is_active==True).order_by(CustomField.sort_order).all()
    return [ser_field(f) for f in fields]

@router.post("/layout/fields")
def create_field(data: LayoutFieldIn, db: Session=Depends(get_db), _=Depends(require_admin)):
    f = CustomField(**data.model_dump(), module="service"); db.add(f); db.commit(); db.refresh(f); return ser_field(f)

@router.put("/layout/fields/{fid}")
def update_field(fid: int, data: LayoutFieldIn, db: Session=Depends(get_db), _=Depends(require_admin)):
    f = db.query(CustomField).filter(CustomField.id==fid).first()
    if f:
        for k,v in data.model_dump().items(): setattr(f,k,v)
        f.module="service"; db.commit(); db.refresh(f); return ser_field(f)
    raise HTTPException(404)

@router.delete("/layout/fields/{fid}")
def delete_field(fid: int, db: Session=Depends(get_db), _=Depends(require_admin)):
    f = db.query(CustomField).filter(CustomField.id==fid).first()
    if f: f.is_active=False; db.commit()
    return {"message":"Deleted"}

@router.get("/layout/stage-rules")
def get_stage_rules(db: Session=Depends(get_db), _=Depends(get_current_user)):
    rules = db.query(CRMStageRule).join(Stage).filter(Stage.module == "service").all()
    return [{"id":r.id,"field_name":r.field_name,"stage_id":r.stage_id,"condition_operator":r.condition_operator,"condition_value":r.condition_value} for r in rules]

@router.post("/layout/stage-rules")
def save_stage_rule(data: StageRuleIn, db: Session=Depends(get_db), _=Depends(require_admin)):
    r = db.query(CRMStageRule).filter(CRMStageRule.field_name == data.field_name).first()
    if r:
        for k,v in data.model_dump().items(): setattr(r,k,v)
    else:
        r = CRMStageRule(**data.model_dump()); db.add(r)
    db.commit()
    return {"success": True}

@router.delete("/layout/stage-rules/{rid}")
def delete_stage_rule(rid: int, db: Session=Depends(get_db), _=Depends(require_admin)):
    r = db.query(CRMStageRule).filter(CRMStageRule.id == rid).first()
    if r: db.delete(r); db.commit()
    return {"success": True}
