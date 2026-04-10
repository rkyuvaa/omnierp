from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from app.database import get_db
from app.models import CustomField, Stage, SequenceConfig
from app.auth import require_admin, get_current_user

router = APIRouter()

class FieldIn(BaseModel):
    module: str
    field_name: str
    field_label: str
    field_type: str  # text, number, date, selection, boolean
    options: List[str] = []
    required: bool = False
    sort_order: int = 0

class StageIn(BaseModel):
    module: str
    name: str
    color: str = "#6366f1"
    sort_order: int = 0
    is_final_win: bool = False
    is_final_lost: bool = False

class SeqIn(BaseModel):
    module: str
    prefix: str = ""
    suffix: str = ""
    padding: int = 4

@router.get("/fields/{module}")
def get_fields(module: str, db: Session = Depends(get_db)):
    return db.query(CustomField).filter(CustomField.module == module, CustomField.is_active == True).order_by(CustomField.sort_order).all()

@router.post("/fields")
def create_field(data: FieldIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    f = CustomField(**data.model_dump()); db.add(f); db.commit(); db.refresh(f); return f

@router.put("/fields/{fid}")
def update_field(fid: int, data: FieldIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    f = db.query(CustomField).filter(CustomField.id == fid).first()
    if not f: raise HTTPException(404, "Not found")
    for k, v in data.model_dump().items(): setattr(f, k, v)
    db.commit(); db.refresh(f); return f

@router.delete("/fields/{fid}")
def delete_field(fid: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    f = db.query(CustomField).filter(CustomField.id == fid).first()
    if not f: raise HTTPException(404, "Not found")
    f.is_active = False; db.commit(); return {"message": "Deleted"}

@router.get("/stages/{module}")
def get_stages(module: str, db: Session = Depends(get_db)):
    return db.query(Stage).filter(Stage.module == module).order_by(Stage.sort_order).all()

@router.post("/stages")
def create_stage(data: StageIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    s = Stage(**data.model_dump()); db.add(s); db.commit(); db.refresh(s); return s

@router.put("/stages/{sid}")
def update_stage(sid: int, data: StageIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    s = db.query(Stage).filter(Stage.id == sid).first()
    if not s: raise HTTPException(404, "Not found")
    for k, v in data.model_dump().items(): setattr(s, k, v)
    db.commit(); db.refresh(s); return s

@router.delete("/stages/{sid}")
def delete_stage(sid: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    s = db.query(Stage).filter(Stage.id == sid).first()
    if not s: raise HTTPException(404, "Not found")
    db.delete(s); db.commit(); return {"message": "Deleted"}

@router.get("/sequence/{module}")
def get_sequence(module: str, db: Session = Depends(get_db)):
    seq = db.query(SequenceConfig).filter(SequenceConfig.module == module).first()
    return seq or {}

@router.post("/sequence")
def upsert_sequence(data: SeqIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    seq = db.query(SequenceConfig).filter(SequenceConfig.module == data.module).first()
    if seq:
        seq.prefix = data.prefix; seq.suffix = data.suffix; seq.padding = data.padding
    else:
        seq = SequenceConfig(**data.model_dump()); db.add(seq)
    db.commit(); db.refresh(seq); return seq
