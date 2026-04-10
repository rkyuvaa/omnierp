from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Lead, Installation, ServiceRequest, Customer, Stage
from app.auth import get_current_user

router = APIRouter()

@router.get("/")
def dashboard(db: Session = Depends(get_db), cu=Depends(get_current_user)):
    crm_stages = db.query(Stage).filter(Stage.module == "crm").order_by(Stage.sort_order).all()
    inst_stages = db.query(Stage).filter(Stage.module == "installation").order_by(Stage.sort_order).all()
    svc_stages = db.query(Stage).filter(Stage.module == "service").order_by(Stage.sort_order).all()

    recent_leads = db.query(Lead).order_by(Lead.id.desc()).limit(5).all()
    recent = [{"ref": l.reference, "title": l.title, "stage": l.stage.name if l.stage else "-", "created": str(l.created_at)[:10]} for l in recent_leads]

    return {
        "stats": {
            "leads": db.query(Lead).count(),
            "installations": db.query(Installation).count(),
            "services": db.query(ServiceRequest).count(),
            "customers": db.query(Customer).count(),
        },
        "leads_by_stage": [{"stage": s.name, "color": s.color, "count": db.query(Lead).filter(Lead.stage_id == s.id).count()} for s in crm_stages],
        "inst_by_stage": [{"stage": s.name, "color": s.color, "count": db.query(Installation).filter(Installation.stage_id == s.id).count()} for s in inst_stages],
        "svc_by_stage": [{"stage": s.name, "color": s.color, "count": db.query(ServiceRequest).filter(ServiceRequest.stage_id == s.id).count()} for s in svc_stages],
        "recent_leads": recent,
    }
