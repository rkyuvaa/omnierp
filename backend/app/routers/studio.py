from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
import uuid, os, shutil
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from ..database import get_db
from ..models import (
    Stage, CRMTab, CRMField, CRMStageRule, SequenceConfig, 
    InstallationTab, InstallationField, InstallationStageRule,
    ServiceTab, ServiceField, ServiceStageRule,
    WarrantyTab, WarrantyField, WarrantyStageRule,
    KonwertCareTab, KonwertCareField, KonwertCareStageRule
)
from ..auth import get_current_user, require_admin
from pydantic import BaseModel

router = APIRouter()

# ── Schemas ───────────────────────────────────────────────────
class TabIn(BaseModel):
    name: str
    sort_order: int = 0
    visibility_stages: List[int] = []

class FieldIn(BaseModel):
    tab_id: Optional[int] = None
    field_name: str
    field_label: str
    field_type: str
    placeholder: Optional[str] = None
    options: list = []
    required: bool = False
    width: str = "full"
    visibility_rule: Optional[dict] = None
    sort_order: int = 0

class StageRuleIn(BaseModel):
    field_name: str
    stage_id: int
    condition_operator: str = "has_value"
    condition_value: Optional[str] = None

class SequenceIn(BaseModel):
    prefix: Optional[str] = None
    suffix: Optional[str] = None
    padding: int = 4

# ── Helpers ───────────────────────────────────────────────────
def get_layout_models(module: str):
    mapping = {
        "crm": (CRMTab, CRMField, CRMStageRule),
        "installation": (InstallationTab, InstallationField, InstallationStageRule),
        "service": (ServiceTab, ServiceField, ServiceStageRule),
        "warranty": (WarrantyTab, WarrantyField, WarrantyStageRule),
        "konwertcare": (KonwertCareTab, KonwertCareField, KonwertCareStageRule)
    }
    if module not in mapping:
        raise HTTPException(status_code=400, detail="Invalid module")
    return mapping[module]

def ser_field(f):
    return {"id":f.id,"tab_id":f.tab_id,"field_name":f.field_name,"field_label":f.field_label,
            "field_type":f.field_type,"placeholder":f.placeholder or "","options":f.options or [],
            "required":f.required,"width":f.width or "full","visibility_rule":f.visibility_rule,
            "sort_order":f.sort_order, "form_template_id": getattr(f, 'form_template_id', None)}

# ── Stages ────────────────────────────────────────────────────
@router.get("/stages/{module}")
@router.get("/stages")
def get_stages(module: str = None, module_query: str = Query(None, alias="module"), db: Session = Depends(get_db)):
    m = module or module_query
    if not m: return []
    return db.query(Stage).filter(Stage.module == m).order_by(Stage.sort_order).all()

# ── Layout (Tabs & Fields) ────────────────────────────────────
@router.get("/layout/{module}/tabs")
def get_tabs(module: str, db: Session = Depends(get_db)):
    TabModel, _, _ = get_layout_models(module)
    tabs = db.query(TabModel).filter(TabModel.is_active == True).order_by(TabModel.sort_order).all()
    res = []
    for t in tabs:
        res.append({
            "id": t.id,
            "name": t.name,
            "sort_order": t.sort_order,
            "visibility_stages": getattr(t, 'visibility_stages', []),
            "fields": [ser_field(f) for f in t.fields if f.is_active]
        })
    return res

@router.post("/layout/{module}/tabs")
def create_tab(module: str, data: TabIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    TabModel, _, _ = get_layout_models(module)
    tab = TabModel(**data.model_dump(exclude={'visibility_stages'}))
    # Some tables might not have module column if they are specific
    if hasattr(tab, 'module'): tab.module = module
    if hasattr(tab, 'visibility_stages'): tab.visibility_stages = data.visibility_stages
    db.add(tab); db.commit(); db.refresh(tab)
    return {"id": tab.id, "name": tab.name, "sort_order": tab.sort_order, "fields": []}

@router.put("/layout/{module}/tabs/{tid}")
def update_tab(module: str, tid: int, data: TabIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    TabModel, _, _ = get_layout_models(module)
    tab = db.query(TabModel).filter(TabModel.id == tid).first()
    if not tab: raise HTTPException(404)
    tab.name = data.name; tab.sort_order = data.sort_order
    if hasattr(tab, 'visibility_stages'): tab.visibility_stages = data.visibility_stages
    db.commit(); return {"id":tab.id, "name":tab.name}

@router.delete("/layout/{module}/tabs/{tid}")
def delete_tab(module: str, tid: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    TabModel, _, _ = get_layout_models(module)
    tab = db.query(TabModel).filter(TabModel.id == tid).first()
    if not tab: raise HTTPException(404)
    tab.is_active = False; db.commit(); return {"status": "ok"}

@router.post("/layout/{module}/fields")
def create_field(module: str, data: FieldIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    _, FieldModel, _ = get_layout_models(module)
    field = FieldModel(**data.model_dump())
    if hasattr(field, 'module'): field.module = module
    db.add(field); db.commit(); db.refresh(field)
    return ser_field(field)

@router.put("/layout/{module}/fields/{fid}")
def update_field(module: str, fid: int, data: FieldIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    _, FieldModel, _ = get_layout_models(module)
    f = db.query(FieldModel).filter(FieldModel.id == fid).first()
    if not f: raise HTTPException(404)
    for k, v in data.model_dump().items(): setattr(f, k, v)
    db.commit(); return ser_field(f)

@router.delete("/layout/{module}/fields/{fid}")
def delete_field(module: str, fid: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    _, FieldModel, _ = get_layout_models(module)
    f = db.query(FieldModel).filter(FieldModel.id == fid).first()
    if not f: raise HTTPException(404)
    f.is_active = False; db.commit(); return {"status": "ok"}

# ── Stage Rules ───────────────────────────────────────────────
@router.get("/layout/{module}/stage-rules")
def get_rules(module: str, db: Session = Depends(get_db)):
    _, _, RuleModel = get_layout_models(module)
    return db.query(RuleModel).all()

@router.post("/layout/{module}/stage-rules")
def create_rule(module: str, data: StageRuleIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    _, _, RuleModel = get_layout_models(module)
    db.query(RuleModel).filter(RuleModel.field_name == data.field_name).delete()
    rule = RuleModel(**data.model_dump())
    db.add(rule); db.commit(); db.refresh(rule)
    return rule

@router.delete("/layout/{module}/stage-rules/{rid}")
def delete_rule(module: str, rid: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    _, _, RuleModel = get_layout_models(module)
    db.query(RuleModel).filter(RuleModel.id == rid).delete()
    db.commit(); return {"status": "ok"}

# ── Sequence ──────────────────────────────────────────────────
@router.get("/sequence/{module}")
def get_sequence(module: str, db: Session = Depends(get_db)):
    return db.query(SequenceConfig).filter(SequenceConfig.module == module).first()

@router.post("/sequence/{module}")
def save_sequence(module: str, data: SequenceIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    seq = db.query(SequenceConfig).filter(SequenceConfig.module == module).first()
    if not seq:
        seq = SequenceConfig(module=module, **data.model_dump())
        db.add(seq)
    else:
        for k, v in data.model_dump().items(): setattr(seq, k, v)
    db.commit(); return seq

# ── File Upload ───────────────────────────────────────────────
@router.post("/upload")
def upload_file(file: UploadFile = File(...), current_user=Depends(get_current_user)):
    # Create directory if not exists
    upload_dir = "static/uploads"
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir)
        
    ext = os.path.splitext(file.filename)[1]
    unique_name = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(upload_dir, unique_name)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {
        "filename": unique_name,
        "original_name": file.filename,
        "url": f"/api/static/uploads/{unique_name}",
        "content_type": file.content_type
    }
