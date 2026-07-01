from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from app.database import get_db
from app.auth import get_current_user
from app.hr_models import HRLopWaterfallRule, HRLeaveType

router = APIRouter()


class LopRuleCreate(BaseModel):
    leave_type_id: int
    priority: int
    respect_monthly_limit: bool = True
    is_active: bool = True


class LopRuleUpdate(BaseModel):
    leave_type_id: Optional[int] = None
    priority: Optional[int] = None
    respect_monthly_limit: Optional[bool] = None
    is_active: Optional[bool] = None


class LopRuleBulkReorder(BaseModel):
    """List of {id, priority} objects for bulk reordering."""
    rules: List[dict]


@router.get("/")
def list_lop_rules(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Return all LOP waterfall rules ordered by priority."""
    rules = db.query(HRLopWaterfallRule).order_by(HRLopWaterfallRule.priority).all()
    result = []
    for r in rules:
        lt = r.leave_type
        result.append({
            "id": r.id,
            "leave_type_id": r.leave_type_id,
            "leave_type_name": lt.name if lt else None,
            "leave_type_code": lt.code if lt else None,
            "priority": r.priority,
            "respect_monthly_limit": r.respect_monthly_limit,
            "is_active": r.is_active,
            "created_at": str(r.created_at),
        })
    return result


@router.post("/")
def create_lop_rule(payload: LopRuleCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Create a new waterfall rule."""
    existing = db.query(HRLopWaterfallRule).filter(
        HRLopWaterfallRule.leave_type_id == payload.leave_type_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="A waterfall rule for this leave type already exists.")

    # Shift priorities if needed
    rules_at_or_after = db.query(HRLopWaterfallRule).filter(
        HRLopWaterfallRule.priority >= payload.priority
    ).all()
    for r in rules_at_or_after:
        r.priority += 1

    rule = HRLopWaterfallRule(
        leave_type_id=payload.leave_type_id,
        priority=payload.priority,
        respect_monthly_limit=payload.respect_monthly_limit,
        is_active=payload.is_active,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    lt = db.query(HRLeaveType).filter(HRLeaveType.id == rule.leave_type_id).first()
    return {
        "id": rule.id,
        "leave_type_id": rule.leave_type_id,
        "leave_type_name": lt.name if lt else None,
        "leave_type_code": lt.code if lt else None,
        "priority": rule.priority,
        "respect_monthly_limit": rule.respect_monthly_limit,
        "is_active": rule.is_active,
    }


@router.put("/reorder")
def reorder_lop_rules(payload: LopRuleBulkReorder, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Bulk update priorities — accepts {rules: [{id, priority}, ...]}."""
    for item in payload.rules:
        rule = db.query(HRLopWaterfallRule).filter(HRLopWaterfallRule.id == item["id"]).first()
        if rule:
            rule.priority = item["priority"]
            rule.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Rules reordered successfully"}


@router.put("/{rule_id}")
def update_lop_rule(rule_id: int, payload: LopRuleUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Update a single rule's settings."""
    rule = db.query(HRLopWaterfallRule).filter(HRLopWaterfallRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    if payload.leave_type_id is not None:
        rule.leave_type_id = payload.leave_type_id
    if payload.priority is not None:
        rule.priority = payload.priority
    if payload.respect_monthly_limit is not None:
        rule.respect_monthly_limit = payload.respect_monthly_limit
    if payload.is_active is not None:
        rule.is_active = payload.is_active
    rule.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Rule updated"}


@router.delete("/{rule_id}")
def delete_lop_rule(rule_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Delete a rule and re-normalize priorities."""
    rule = db.query(HRLopWaterfallRule).filter(HRLopWaterfallRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    deleted_priority = rule.priority
    db.delete(rule)
    later = db.query(HRLopWaterfallRule).filter(
        HRLopWaterfallRule.priority > deleted_priority
    ).all()
    for r in later:
        r.priority -= 1
    db.commit()
    return {"message": "Rule deleted"}
