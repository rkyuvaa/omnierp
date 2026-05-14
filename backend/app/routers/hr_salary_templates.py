from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from app.database import get_db
from app.models import User
from app.auth import get_current_user
from app.hr_models import HRSalaryTemplate

router = APIRouter()

class SalaryComponent(BaseModel):
    component_id: Optional[int] = None
    name: str
    type: str = "earning"
    is_percentage: bool = True
    value: float

class SalaryTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    components: List[SalaryComponent]

@router.get("/")
def list_templates(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(HRSalaryTemplate).all()

@router.post("/")
def create_template(data: SalaryTemplateCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Check if exists
    if db.query(HRSalaryTemplate).filter(HRSalaryTemplate.name == data.name).first():
        raise HTTPException(400, "Template name already exists")
    
    template = HRSalaryTemplate(
        name=data.name,
        description=data.description,
        components=[c.model_dump() for c in data.components]
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template

@router.put("/{template_id}")
def update_template(template_id: int, data: SalaryTemplateCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    template = db.query(HRSalaryTemplate).filter(HRSalaryTemplate.id == template_id).first()
    if not template: raise HTTPException(404, "Template not found")
    
    template.name = data.name
    template.description = data.description
    template.components = [c.model_dump() for c in data.components]
    db.commit()
    return template

@router.delete("/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    template = db.query(HRSalaryTemplate).filter(HRSalaryTemplate.id == template_id).first()
    if not template: raise HTTPException(404, "Template not found")
    db.delete(template)
    db.commit()
    return {"message": "Deleted"}
