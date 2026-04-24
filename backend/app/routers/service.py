from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func, cast, Date
from pydantic import BaseModel
from typing import Optional
import datetime
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
    phone: Optional[str] = None
    contact_name: Optional[str] = None
    contact_number: Optional[str] = None
    invoice_number: Optional[str] = None
    vehicle_year: Optional[str] = None
    delivery_date: Optional[str] = None
    vehicle_number: Optional[str] = None
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None
    product_id: Optional[int] = None
    problem_description: Optional[str] = None
    stage_id: Optional[int] = None
    staff_id: Optional[int] = None
    notes: Optional[str] = None
    custom_data: dict = {}

def serialize(r: ServiceRequest):
    warranty_info = "— No Data —"
    if r.product:
        if r.product.warranty_start_date and r.product.warranty_end_date:
            warranty_info = f"{r.product.warranty_start_date} to {r.product.warranty_end_date}"
        elif r.product.warranty_period:
            warranty_info = f"{r.product.warranty_period} {r.product.warranty_unit or 'months'}"

    return {
        "id": r.id, 
        "reference": r.reference, 
        "customer_name": r.customer_name,
        "phone": r.phone,
        "contact_name": r.contact_name,
        "contact_number": r.contact_number,
        "invoice_number": r.invoice_number,
        "vehicle_year": r.vehicle_year,
        "delivery_date": str(r.delivery_date) if r.delivery_date else None,
        "vehicle_number": r.vehicle_number, 
        "vehicle_make": r.vehicle_make,
        "vehicle_model": r.vehicle_model, 
        "product_id": r.product_id,
        "product_serial": r.product.serial_number if r.product else None,
        "product_stage_name": r.product.stage.name if (r.product and r.product.stage) else None,
        "product_stage_color": r.product.stage.color if (r.product and r.product.stage) else None,
        "warranty_info": warranty_info,
        "problem_description": r.problem_description,
        "stage_id": r.stage_id, 
        "staff_id": r.staff_id, 
        "notes": r.notes,
        "custom_data": r.custom_data or {}, 
        "created_at": str(r.created_at),
        "stage_name": r.stage.name if r.stage else None,
        "stage_color": r.stage.color if r.stage else None,
        "staff_name": r.staff.name if r.staff else None,
    }

@router.get("/")
def list_svc(
    request: Request,
    search: Optional[str] = None, stage_id: Optional[int] = None, 
    skip: int = 0, limit: int = 50, group_by: Optional[str] = None,
    db: Session = Depends(get_db), cu=Depends(get_current_user)
):
    # Extract extra filters from query params
    all_params = dict(request.query_params)
    reserved = ['search', 'stage_id', 'skip', 'limit', 'group_by']
    extra_filters = {k: v for k, v in all_params.items() if k not in reserved}

    q = db.query(ServiceRequest).options(joinedload(ServiceRequest.stage), joinedload(ServiceRequest.staff), joinedload(ServiceRequest.product))
    
    # Apply simple extra filters first
    for k, v in extra_filters.items():
        if hasattr(ServiceRequest, k):
            attr = getattr(ServiceRequest, k)
            if v == 'null':
                q = q.filter(attr == None)
            else:
                q = q.filter(attr == v)
                
    import json
    import urllib.parse
    # Handle advanced JSON stringified filters
    filters_param = all_params.get('filters')
    if filters_param:
        try:
            # Safely unquote just in case it wasn't decoded by FastAPI
            decoded_param = urllib.parse.unquote(filters_param)
            advanced_filters = json.loads(decoded_param)
            for k, rules in advanced_filters.items():
                # rules is either a simple value, or a list of [{op: '=', val: '...'}, ...]
                if not isinstance(rules, list):
                    # Fallback for simple filter
                    rules = [{'op': '=', 'val': rules}]
                
                for rule in rules:
                    op = rule.get('op', '=')
                    val = rule.get('val')
                    if val is None or val == '': continue
                    
                    # Resolve column attribute (standard or JSON custom_data)
                    attr = None
                    if hasattr(ServiceRequest, k):
                        attr = getattr(ServiceRequest, k)
                    elif k.startswith("custom_data__"):
                        json_key = k.replace("custom_data__", "")
                        attr = ServiceRequest.custom_data[json_key].astext
                    
                    if attr is not None:
                        if op == '=': q = q.filter(attr == val)
                        elif op == '!=': q = q.filter(attr != val)
                        elif op == 'ilike': q = q.filter(attr.ilike(f"%{val}%"))
                        elif op == '>': q = q.filter(attr > val)
                        elif op == '<': q = q.filter(attr < val)
        except Exception as e:
            print("Error parsing advanced filters:", e)

    if search: 
        q = q.filter(or_(
            ServiceRequest.customer_name.ilike(f"%{search}%"), 
            ServiceRequest.vehicle_number.ilike(f"%{search}%"),
            ServiceRequest.reference.ilike(f"%{search}%")
        ))
    
    # Handle staff_id filter
    staff_id_filter = db.query(ServiceRequest).filter(False) # Empty by default
    staff_id_val = None
    
    # Check if staff_id is in params via extra logic
    # In list_svc, we should iterate over kwargs or handle explicitly
    # But for now I'll check if any other filters were passed

    # Stage counts based on filtered query (before pagination)
    stage_counts = {str(s_id): count for s_id, count in q.with_entities(ServiceRequest.stage_id, func.count(ServiceRequest.id)).group_by(ServiceRequest.stage_id).all() if s_id}
    
    if stage_id: q = q.filter(ServiceRequest.stage_id == stage_id)
    total = q.count()
    items = q.order_by(ServiceRequest.id.desc()).offset(skip).limit(limit).all()
    
    serialized = [serialize(r) for r in items]
    
    if group_by:
        # Simple grouping logic: returns a list of { group: "Name", items: [...] }
        groups = {}
        for item in serialized:
            g_key = item.get(group_by)
            # Try to get a prettier name for the group key if it's an ID
            if group_by == 'stage_id': g_key = item.get('stage_name') or 'No Stage'
            elif group_by == 'staff_id': g_key = item.get('staff_name') or 'Unassigned'
            
            if g_key not in groups: groups[g_key] = []
            groups[g_key].append(item)
        
        grouped_list = [{"group": k, "items": v} for k, v in groups.items()]
        return {"total": total, "items": grouped_list, "stage_counts": stage_counts, "is_grouped": True}
        
    return {"total": total, "items": serialized, "stage_counts": stage_counts}

class AISearchIn(BaseModel):
    query: str

@router.post("/ai-search")
def ai_search_parser(data: AISearchIn, cu=Depends(get_current_user)):
    """
    Passes the user's query to an LLM with the strict system prompt 
    to return a structured JSON filter object.
    """
    import json
    
    # In a real environment, you would call OpenAI/Gemini here:
    # response = openai.chat.completions.create(...)
    
    q = data.query.lower()
    
    # Basic mock parsing logic based on keywords
    domain = []
    active_filters = []
    group_by = []
    explanation = "Showing all results."
    
    if "high priority" in q or "urgent" in q:
        active_filters.append("High Priority")
        explanation = "Showing high priority tickets."
    if "unassigned" in q:
        active_filters.append("Unassigned")
        explanation = "Showing unassigned tickets."
    if "group" in q and "stage" in q:
        group_by.append("stage_id")
        explanation = "Showing tickets grouped by stage."
    if "group" in q and "staff" in q:
        group_by.append("staff_id")
        explanation = "Showing tickets grouped by assigned staff."
        
    if not active_filters and not group_by:
        explanation = f"Searching for: '{data.query}'"
        domain = [["customer_name", "ilike", f"%{data.query}%"]]

    return {
        "domain": domain,
        "group_by": group_by,
        "order_by": "id desc",
        "search_type": "combined",
        "active_filters": active_filters,
        "explanation": explanation
    }

@router.post("/")
def create_svc(data: SvcIn, db: Session = Depends(get_db), cu=Depends(get_current_user)):
    from sqlalchemy.exc import IntegrityError
    
    payload = data.model_dump()
    
    # Handle date conversion for SQLAlchemy
    dev_date = payload.get("delivery_date")
    if dev_date and isinstance(dev_date, str) and dev_date.strip():
        try:
            payload["delivery_date"] = datetime.datetime.strptime(dev_date.strip(), "%Y-%m-%d").date()
        except:
            payload["delivery_date"] = None
    else:
        payload["delivery_date"] = None
            
    max_retries = 3
    for attempt in range(max_retries):
        try:
            ref = next_sequence(db, "service")
            r = ServiceRequest(**payload, reference=ref, created_by=cu.id)
            db.add(r)
            db.commit()
            db.refresh(r)
            
            log_action(db, cu, "CREATE", "service", r.id, ref)
            return serialize(r)
        except IntegrityError as e:
            db.rollback()
            if attempt < max_retries - 1:
                continue # Retry to get next sequence
            print(f"CRITICAL SAVE ERROR (IntegrityError): {str(e)}")
            raise HTTPException(status_code=500, detail=f"Database Save Error: Duplicate reference constraint.")
        except Exception as e:
            db.rollback()
            print(f"CRITICAL SAVE ERROR: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Database Save Error: {str(e)}")

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
