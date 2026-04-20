from sqlalchemy.orm import Session
from ..models import KonwertCareTicket, Installation, Stage
from datetime import datetime
import logging

def trigger_konwert_care_handoff(installation: Installation, db: Session):
    """
    Automatically creates a Konwert Care+ ticket when an installation is completed.
    """
    try:
        # Check if a ticket already exists for this installation to prevent duplicates
        existing = db.query(KonwertCareTicket).filter(
            KonwertCareTicket.vehicle_number == installation.vehicle_number,
            KonwertCareTicket.customer_name == installation.customer_name
        ).first()
        
        if existing:
            return None
            
        # Generate Reference
        last = db.query(KonwertCareTicket).order_by(KonwertCareTicket.id.desc()).first()
        next_id = (last.id + 1) if last else 1
        ref = f"CARE/{datetime.now().year}/{next_id:04d}"
        
        # Create Ticket
        ticket = KonwertCareTicket(
            reference=ref,
            customer_name=installation.customer_name,
            phone=installation.phone,
            email=installation.email,
            vehicle_number=installation.vehicle_number,
            vehicle_make=installation.vehicle_make,
            vehicle_model=installation.vehicle_model,
            product_serial=installation.product_serial,
            issue_type="Vehicle Delivery", # Default for new installations
            issue_description=f"Auto-generated from successful installation {installation.reference}.",
            notes=f"Installation Reference: {installation.reference}\nTechnician: {installation.technician_name if hasattr(installation, 'technician_name') else 'N/A'}",
            created_by=installation.created_by,
            custom_data={"source": "installation", "installation_id": installation.id, "warranty_status": "Pending"}
        )
        
        db.add(ticket)
        db.commit()
        db.refresh(ticket)
        return ticket
    except Exception as e:
        logging.error(f"Failed to auto-create Care ticket: {str(e)}")
        db.rollback()
        return None
