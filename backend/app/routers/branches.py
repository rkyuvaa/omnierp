from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models import Branch
from app.auth import require_admin

router = APIRouter()

class BranchIn(BaseModel):
    name: str
    address: Optional[str] = None
    is_active: bool = True

@router.get("/")
def list_branches(db: Session = Depends(get_db)):
    return db.query(Branch).all()

@router.post("/")
def create_branch(data: BranchIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    b = Branch(**data.model_dump()); db.add(b); db.commit(); db.refresh(b)
    return b

@router.put("/{bid}")
def update_branch(bid: int, data: BranchIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    b = db.query(Branch).filter(Branch.id == bid).first()
    if not b: raise HTTPException(404, "Not found")
    for k, v in data.model_dump().items(): setattr(b, k, v)
    db.commit(); db.refresh(b); return b

@router.delete("/{bid}")
def delete_branch(bid: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    b = db.query(Branch).filter(Branch.id == bid).first()
    if not b: raise HTTPException(404, "Not found")
    db.delete(b); db.commit(); return {"message": "Deleted"}
