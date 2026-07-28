from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel
from typing import Optional
import openpyxl
import io
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

@router.post("/import")
async def import_matrix(file: UploadFile = File(...), db: Session = Depends(get_db), cu=Depends(get_current_user)):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(400, "Please upload an Excel file (.xlsx or .xls)")
    
    content = await file.read()
    wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
    ws = wb.active
    
    rows = list(ws.rows)
    if len(rows) < 2:
        raise HTTPException(400, "File is empty or missing headers")
    
    # Map headers to model fields
    headers = [cell.value.lower().strip() if cell.value else "" for cell in rows[0]]
    mapping = {
        "system": "system",
        "issue": "issue",
        "issue code": "issue_code",
        "subsystem": "subsystem",
        "priority": "priority",
        "safety risk": "safety_risk",
        "operable vehicle": "operable_vehicle",
        "diagnostic method": "diagnostic_method",
        "action type": "action_type",
        "corrective action": "corrective_action",
        "part id": "part_id",
        "qty": "qty",
        "sop": "sop",
        "labour time in minutes": "labour_time_minutes",
        "serviceable location": "serviceable_location",
        "warranty": "warranty",
        "warranty policy": "warranty_policy",
        "loaner vehicle required": "loaner_vehicle_required",
        "part cost": "part_cost",
        "rework cost": "rework_cost",
        "labour cost": "labour_cost",
        "root cause category": "root_cause_category"
    }

    imported_count = 0
    for row_cells in rows[1:]:
        data = {}
        for idx, cell in enumerate(row_cells):
            header = headers[idx] if idx < len(headers) else ""
            field = mapping.get(header)
            if field:
                val = cell.value
                if field == "loaner_vehicle_required":
                    val = str(val).lower() in ("yes", "true", "1")
                elif field in ("qty", "labour_time_minutes", "part_cost", "rework_cost", "labour_cost"):
                    try: val = float(val) if val is not None else None
                    except: val = None
                data[field] = val
        
        if any(data.values()):
            db.add(IssueWorkMatrix(**data))
            imported_count += 1
            
    db.commit()
    return {"status": "ok", "imported": imported_count}

@router.get("/export")
def export_matrix(db: Session = Depends(get_db), cu=Depends(get_current_user)):
    rows = db.query(IssueWorkMatrix).all()
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Issue Work Matrix"
    
    headers = [
        "System", "Issue", "Issue Code", "Subsystem", "Priority", 
        "Safety Risk", "Operable Vehicle", "Diagnostic Method", 
        "Action Type", "Corrective Action", "Part ID", "Qty", "SOP", 
        "Labour Time in Minutes", "Serviceable Location", "Warranty", 
        "Warranty Policy", "Loaner Vehicle Required", "Part Cost", 
        "Rework Cost", "Labour Cost", "Root Cause Category"
    ]
    ws.append(headers)
    
    for r in rows:
        ws.append([
            r.system, r.issue, r.issue_code, r.subsystem, r.priority,
            r.safety_risk, r.operable_vehicle, r.diagnostic_method,
            r.action_type, r.corrective_action, r.part_id, r.qty, r.sop,
            r.labour_time_minutes, r.serviceable_location, r.warranty,
            r.warranty_policy, "Yes" if r.loaner_vehicle_required else "No",
            r.part_cost, r.rework_cost, r.labour_cost, r.root_cause_category
        ])
        
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=issue_work_matrix.xlsx"}
    )
