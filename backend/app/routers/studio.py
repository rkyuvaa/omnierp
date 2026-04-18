from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from ..database import get_db
from ..models import Stage, CRMTab, CRMField, CRMStageRule, SequenceConfig
from ..auth import get_current_user, require_admin
from pydantic import BaseModel

router = APIRouter()

# ── Schemas ───────────────────────────────────────────────────
class TabIn(BaseModel):
    name: str
    sort_order: int = 0

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
def ser_field(f):
    return {"id":f.id,"tab_id":f.tab_id,"field_name":f.field_name,"field_label":f.field_label,
            "field_type":f.field_type,"placeholder":f.placeholder or "","options":f.options or [],
            "required":f.required,"width":f.width or "full","visibility_rule":f.visibility_rule,"sort_order":f.sort_order}

# ── Stages ────────────────────────────────────────────────────
@router.get("/stages/{module}")
def get_stages(module: str, db: Session = Depends(get_db)):
    return db.query(Stage).filter(Stage.module == module).order_by(Stage.sort_order).all()

# ── Layout (Tabs & Fields) ────────────────────────────────────
@router.get("/layout/{module}/tabs")
def get_tabs(module: str, db: Session = Depends(get_db)):
    tabs = db.query(CRMTab).filter(CRMTab.module == module, CRMTab.is_active == True).order_by(CRMTab.sort_order).all()
    res = []
    for t in tabs:
        res.append({
            "id": t.id,
            "name": t.name,
            "sort_order": t.sort_order,
            "fields": [ser_field(f) for f in t.fields if f.is_active]
        })
    return res

@router.post("/layout/{module}/tabs")
def create_tab(module: str, data: TabIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    tab = CRMTab(**data.model_dump(), module=module)
    db.add(tab); db.commit(); db.refresh(tab)
    return {"id": tab.id, "name": tab.name, "sort_order": tab.sort_order, "fields": []}

@router.put("/layout/tabs/{tid}")
def update_tab(tid: int, data: TabIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    tab = db.query(CRMTab).filter(CRMTab.id == tid).first()
    if not tab: raise HTTPException(404)
    tab.name = data.name; tab.sort_order = data.sort_order
    db.commit(); return tab

@router.delete("/layout/tabs/{tid}")
def delete_tab(tid: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    tab = db.query(CRMTab).filter(CRMTab.id == tid).first()
    if not tab: raise HTTPException(404)
    tab.is_active = False; db.commit(); return {"status": "ok"}

@router.post("/layout/{module}/fields")
def create_field(module: str, data: FieldIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    field = CRMField(**data.model_dump(), module=module)
    db.add(field); db.commit(); db.refresh(field)
    return ser_field(field)

@router.put("/layout/fields/{fid}")
def update_field(fid: int, data: FieldIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    f = db.query(CRMField).filter(CRMField.id == fid).first()
    if not f: raise HTTPException(404)
    for k, v in data.model_dump().items(): setattr(f, k, v)
    db.commit(); return ser_field(f)

@router.delete("/layout/fields/{fid}")
def delete_field(fid: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    f = db.query(CRMField).filter(CRMField.id == fid).first()
    if not f: raise HTTPException(404)
    f.is_active = False; db.commit(); return {"status": "ok"}

# ── Stage Rules ───────────────────────────────────────────────
@router.get("/layout/{module}/stage-rules")
def get_rules(module: str, db: Session = Depends(get_db)):
    # Rules are linked to stages, and stages are linked to modules
    return db.query(CRMStageRule).join(Stage).filter(Stage.module == module).all()

@router.post("/layout/{module}/stage-rules")
def create_rule(module: str, data: StageRuleIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    db.query(CRMStageRule).filter(CRMStageRule.field_name == data.field_name).delete()
    rule = CRMStageRule(**data.model_dump())
    db.add(rule); db.commit(); db.refresh(rule)
    return rule

@router.delete("/layout/stage-rules/{rid}")
def delete_rule(rid: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    db.query(CRMStageRule).filter(CRMStageRule.id == rid).delete()
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
