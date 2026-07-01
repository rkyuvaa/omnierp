from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Any, Optional
from app.database import get_db
from app.auth import get_current_user
from app.hr_models import HRConfig
from pydantic import BaseModel
from datetime import datetime

router = APIRouter()

class HRConfigSchema(BaseModel):
    key: str
    value: Any

@router.get("/")
def get_all_configs(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    configs = db.query(HRConfig).all()
    return {c.key: c.value for c in configs}

@router.get("/{key}")
def get_config(key: str, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    db_config = db.query(HRConfig).filter(HRConfig.key == key).first()
    if not db_config:
        return {"key": key, "value": None}
    return {"key": db_config.key, "value": db_config.value}

@router.post("/")
def update_config(config: HRConfigSchema, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    db_config = db.query(HRConfig).filter(HRConfig.key == config.key).first()
    if db_config:
        db_config.value = config.value
        db_config.updated_at = datetime.utcnow()
    else:
        db_config = HRConfig(key=config.key, value=config.value)
        db.add(db_config)
    db.commit()
    return {"message": f"Configuration '{config.key}' updated successfully"}

# Helper function for internal use
def get_hr_config(db: Session, key: str, default: Any = None):
    db_config = db.query(HRConfig).filter(HRConfig.key == key).first()
    return db_config.value if db_config else default


# ─────────────────────────────────────────────
# COMP-OFF SETUP
# ─────────────────────────────────────────────
class CompOffSetupPayload(BaseModel):
    enabled: bool
    threshold_hours: float = 9.0
    hours_per_day: float = 8.0
    leave_type_id: Optional[int] = None   # None = auto-create CO type
    expiry_months: Optional[int] = None   # None = no expiry
    activation_date: Optional[str] = None  # ISO date string

@router.post("/comp-off-setup")
def comp_off_setup(payload: CompOffSetupPayload, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Configure Comp-Off auto-accrual. Auto-creates the CO leave type if not specified."""
    from app.hr_models import HRLeaveType

    lt_id = payload.leave_type_id
    if not lt_id:
        # Auto-create Comp-Off leave type if missing
        co_type = db.query(HRLeaveType).filter(HRLeaveType.code == "CO").first()
        if not co_type:
            co_type = HRLeaveType(
                name="Comp-Off",
                code="CO",
                max_days_per_year=0,   # No fixed limit — accrued dynamically
                is_paid=True,
                carry_forward=False,
                carry_forward_max=0,
                is_active=True,
            )
            db.add(co_type)
            db.commit()
            db.refresh(co_type)
        lt_id = co_type.id

    # Save all comp-off settings
    configs_to_save = {
        "comp_off_enabled": payload.enabled,
        "comp_off_threshold_hours": payload.threshold_hours,
        "comp_off_hours_per_day": payload.hours_per_day,
        "comp_off_leave_type_id": lt_id,
        "comp_off_expiry_months": payload.expiry_months,
        "comp_off_activation_date": payload.activation_date,
    }
    for key, value in configs_to_save.items():
        cfg = db.query(HRConfig).filter(HRConfig.key == key).first()
        if cfg:
            cfg.value = value
            cfg.updated_at = datetime.utcnow()
        else:
            cfg = HRConfig(key=key, value=value)
            db.add(cfg)
    db.commit()
    return {"message": "Comp-Off settings saved", "leave_type_id": lt_id}


@router.get("/comp-off-setup")
def get_comp_off_setup(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Return current comp-off settings."""
    keys = ["comp_off_enabled", "comp_off_threshold_hours", "comp_off_hours_per_day",
            "comp_off_leave_type_id", "comp_off_expiry_months", "comp_off_activation_date"]
    return {k: get_hr_config(db, k, None) for k in keys}
