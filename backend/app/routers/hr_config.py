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
