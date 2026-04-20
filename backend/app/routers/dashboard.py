from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.database import get_db
from app.models import Lead, Installation, ServiceRequest, Customer, Stage
from app.auth import get_current_user

router = APIRouter()

@router.get("/")
def dashboard(db: Session = Depends(get_db), cu=Depends(get_current_user)):
    # Fetch stages
    stages = db.query(Stage).order_by(Stage.sort_order).all()
    crm_stages = [s for s in stages if s.module == "crm"]
    inst_stages = [s for s in stages if s.module == "installation"]
    svc_stages = [s for s in stages if s.module == "service"]

    # Efficient counts using group_by
    def get_counts(model):
        res = db.query(model.stage_id, func.count(model.id)).group_by(model.stage_id).all()
        return {r[0]: r[1] for r in res}

    lead_counts = get_counts(Lead)
    inst_counts = get_counts(Installation)
    svc_counts = get_counts(ServiceRequest)

    recent_leads = db.query(Lead).options(joinedload(Lead.stage)).order_by(Lead.id.desc()).limit(5).all()
    recent = [{"ref": l.reference, "title": l.title, "stage": l.stage.name if l.stage else "-", "created": str(l.created_at)[:10]} for l in recent_leads]

    return {
        "stats": {
            "leads": db.query(Lead).count(),
            "installations": db.query(Installation).count(),
            "services": db.query(ServiceRequest).count(),
            "customers": db.query(Customer).count(),
        },
        "leads_by_stage": [{"stage": s.name, "color": s.color, "count": lead_counts.get(s.id, 0)} for s in crm_stages],
        "inst_by_stage": [{"stage": s.name, "color": s.color, "count": inst_counts.get(s.id, 0)} for s in inst_stages],
        "svc_by_stage": [{"stage": s.name, "color": s.color, "count": svc_counts.get(s.id, 0)} for s in svc_stages],
        "recent_leads": recent,
    }
