from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel
from typing import Optional
from ..database import get_db
from ..models import IssueWorkMatrix
from ..auth import get_current_user

router = APIRouter()

class MatrixIn(BaseModel):
    system: Optional[str] = None
    issue: Optional[str] = None
    issue_code: Optional[str] = None
    subsystem: Optional[str] = None
    priority: Optional[str] = None
    safety_risk: Optional[str] = None
    operable_vehicle: Optional[str] = None
    diagnostic_method: Optional[str] = None
    action_type: Optional[str] = None
    corrective_action: Optional[str] = None
    part_id: Optional[str] = None
    qty: Optional[float] = None
    sop: Optional[str] = None
    labour_time_minutes: Optional[float] = None
    serviceable_location: Optional[str] = None
    warranty: Optional[str] = None
    warranty_policy: Optional[str] = None
    loaner_vehicle_required: bool = False
    part_cost: Optional[float] = None
    rework_cost: Optional[float] = None
    labour_cost: Optional[float] = None
    root_cause_category: Optional[str] = None

def serialize(r: IssueWorkMatrix):
    return {
        "id": r.id,
        "system": r.system,
        "issue": r.issue,
        "issue_code": r.issue_code,
        "subsystem": r.subsystem,
        "priority": r.priority,
        "safety_risk": r.safety_risk,
        "operable_vehicle": r.operable_vehicle,
        "diagnostic_method": r.diagnostic_method,
        "action_type": r.action_type,
        "corrective_action": r.corrective_action,
        "part_id": r.part_id,
        "qty": r.qty,
        "sop": r.sop,
        "labour_time_minutes": r.labour_time_minutes,
        "serviceable_location": r.serviceable_location,
        "warranty": r.warranty,
        "warranty_policy": r.warranty_policy,
        "loaner_vehicle_required": r.loaner_vehicle_required,
        "part_cost": r.part_cost,
        "rework_cost": r.rework_cost,
        "labour_cost": r.labour_cost,
        "root_cause_category": r.root_cause_category,
        "created_at": str(r.created_at)[:16] if r.created_at else None,
    }

@router.get("/")
def list_matrix(
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    cu=Depends(get_current_user)
):
    q = db.query(IssueWorkMatrix)
    if search:
        q = q.filter(or_(
            IssueWorkMatrix.system.ilike(f"%{search}%"),
            IssueWorkMatrix.issue.ilike(f"%{search}%"),
            IssueWorkMatrix.issue_code.ilike(f"%{search}%"),
            IssueWorkMatrix.subsystem.ilike(f"%{search}%"),
            IssueWorkMatrix.root_cause_category.ilike(f"%{search}%"),
        ))
    total = q.count()
    items = q.order_by(IssueWorkMatrix.id.desc()).offset(skip).limit(limit).all()
    return {"total": total, "items": [serialize(r) for r in items]}

@router.post("/")
def create_matrix(data: MatrixIn, db: Session = Depends(get_db), cu=Depends(get_current_user)):
    row = IssueWorkMatrix(**data.model_dump())
    db.add(row); db.commit(); db.refresh(row)
    return serialize(row)

@router.put("/{rid}")
def update_matrix(rid: int, data: MatrixIn, db: Session = Depends(get_db), cu=Depends(get_current_user)):
    row = db.query(IssueWorkMatrix).filter(IssueWorkMatrix.id == rid).first()
    if not row: raise HTTPException(404)
    for k, v in data.model_dump().items():
        setattr(row, k, v)
    db.commit(); return serialize(row)

@router.delete("/{rid}")
def delete_matrix(rid: int, db: Session = Depends(get_db), cu=Depends(get_current_user)):
    row = db.query(IssueWorkMatrix).filter(IssueWorkMatrix.id == rid).first()
    if not row: raise HTTPException(404)
    db.delete(row); db.commit(); return {"status": "ok"}
