from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime
from app.database import get_db
from app.models import FormDefinition, FormSubmission, User
from app.auth import get_current_user

router = APIRouter()

class FormDefIn(BaseModel):
    name: str
    prefix_template: str = ""
    suffix_template: str = ""
    reset_cycle: str = "none"
    fields_config: List[Dict[str, Any]] = []
    mapping_config: Dict[str, str] = {}
    pdf_config: Dict[str, Any] = {}

class FormSubmissionIn(BaseModel):
    form_definition_id: int
    parent_id: int
    data: Dict[str, Any] = {}
    status: str = "draft"

# ── Studio: Form Definitions ───────────────────────────────────

@router.get("/studio/forms/{module}")
def get_form_defs(module: str, db: Session = Depends(get_db)):
    return db.query(FormDefinition).filter(FormDefinition.module == module, FormDefinition.is_active == True).all()

@router.post("/studio/forms/{module}")
def create_form_def(module: str, data: FormDefIn, db: Session = Depends(get_db)):
    db_obj = FormDefinition(
        module=module,
        name=data.name,
        prefix_template=data.prefix_template,
        suffix_template=data.suffix_template,
        reset_cycle=data.reset_cycle,
        fields_config=data.fields_config,
        mapping_config=data.mapping_config,
        pdf_config=data.pdf_config
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

@router.put("/studio/forms/{fid}")
def update_form_def(fid: int, data: FormDefIn, db: Session = Depends(get_db)):
    obj = db.query(FormDefinition).filter(FormDefinition.id == fid).first()
    if not obj: raise HTTPException(404)
    for k, v in data.dict().items():
        setattr(obj, k, v)
    db.commit()
    return obj

@router.delete("/studio/forms/{fid}")
def delete_form_def(fid: int, db: Session = Depends(get_db)):
    obj = db.query(FormDefinition).filter(FormDefinition.id == fid).first()
    if not obj: raise HTTPException(404)
    obj.is_active = False
    db.commit()
    return {"status": "deleted"}

# ── Submissions ────────────────────────────────────────────────

def get_next_reference(form: FormDefinition, db: Session):
    now = datetime.utcnow()
    should_reset = False
    
    if not form.last_reset_date:
        should_reset = True
    else:
        if form.reset_cycle == "daily" and now.date() > form.last_reset_date.date():
            should_reset = True
        elif form.reset_cycle == "weekly" and now.isocalendar()[1] != form.last_reset_date.isocalendar()[1]:
            should_reset = True
        elif form.reset_cycle == "monthly" and now.month != form.last_reset_date.month:
            should_reset = True

    if should_reset:
        form.last_number = 1
        form.last_reset_date = now
    else:
        form.last_number += 1

    # Format Date for Template
    # e.g. {YYYY} {MM} {DD}
    date_context = {
        "{YYYY}": now.strftime("%Y"),
        "{YY}": now.strftime("%y"),
        "{MM}": now.strftime("%m"),
        "{DD}": now.strftime("%d"),
    }
    
    prefix = form.prefix_template
    suffix = form.suffix_template
    for k, v in date_context.items():
        prefix = prefix.replace(k, v)
        suffix = suffix.replace(k, v)
    
    ref = f"{prefix}{str(form.last_number).zfill(4)}{suffix}"
    db.add(form)
    db.commit()
    return ref

@router.post("/submissions")
def submit_form(data: FormSubmissionIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    form_def = db.query(FormDefinition).filter(FormDefinition.id == data.form_definition_id).first()
    if not form_def: raise HTTPException(404, "Definition not found")
    
    ref = get_next_reference(form_def, db)
    
    sub = FormSubmission(
        form_definition_id=data.form_definition_id,
        parent_id=data.parent_id,
        reference_number=ref,
        data=data.data,
        status=data.status,
        created_by=user.id
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub

@router.put("/submissions/{sid}")
def update_submission(sid: int, data: Dict[str, Any], db: Session = Depends(get_db)):
    sub = db.query(FormSubmission).filter(FormSubmission.id == sid).first()
    if not sub: raise HTTPException(404)
    if "data" in data: sub.data = data["data"]
    if "status" in data: sub.status = data["status"]
    db.commit()
    return sub

@router.get("/submissions/{module}/{parent_id}")
def get_submissions(module: str, parent_id: int, db: Session = Depends(get_db)):
    return db.query(FormSubmission)\
             .join(FormDefinition)\
             .filter(FormDefinition.module == module, FormSubmission.parent_id == parent_id)\
             .all()

@router.get("/submissions/{sid}")
def get_submission(sid: int, db: Session = Depends(get_db)):
    sub = db.query(FormSubmission).filter(FormSubmission.id == sid).first()
    if not sub: raise HTTPException(404)
    return {
        "id": sub.id,
        "reference_number": sub.reference_number,
        "data": sub.data,
        "status": sub.status,
        "form_name": sub.definition.name,
        "fields_config": sub.definition.fields_config,
        "pdf_config": sub.definition.pdf_config,
        "created_at": sub.created_at
    }
