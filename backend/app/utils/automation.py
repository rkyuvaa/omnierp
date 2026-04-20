from sqlalchemy.orm import Session
from ..models import KonwertCareTicket, Installation, Stage
from datetime import datetime
import logging

def trigger_konwert_care_handoff(installation: Installation, db: Session):
    """
    Automatically creates a Konwert Care+ ticket when an installation is completed.
    """
    try:
        # Fetch stage name for logging/debugging
        stage_name = "Unknown"
        if installation.stage_id:
            stage = db.query(Stage).filter(Stage.id == installation.stage_id).first()
            if stage: stage_name = stage.name
            
        print(f"DEBUG: Triggering Care Handoff check. Stage: '{stage_name}'")
        
        # Fuzzy match for Fitment Done
        target_names = ["fitment done", "completed", "done", "delivered", "fitment completed"]
        if not any(n in stage_name.lower() for n in target_names):
            print(f"DEBUG: Stage '{stage_name}' does not match targets. Skipping.")
            return None

        # Check if a ticket already exists (ignore if names are empty/none)
        if not installation.vehicle_number and not installation.customer_name:
            print("DEBUG: Missing vehicle/customer. Skipping.")
            return None
            
        existing = db.query(KonwertCareTicket).filter(
            KonwertCareTicket.vehicle_number == installation.vehicle_number,
            KonwertCareTicket.customer_name == installation.customer_name
        ).first()
        
        if existing:
            print(f"DEBUG: Ticket already exists for {installation.vehicle_number}. skipping.")
            return None
            
        # Generate Reference
        last = db.query(KonwertCareTicket).order_by(KonwertCareTicket.id.desc()).first()
        next_id = (last.id + 1) if last else 1
        ref = f"CARE/{datetime.now().year}/{next_id:04d}"
        
        # Create Ticket
        ticket = KonwertCareTicket(
            reference=ref,
            customer_name=installation.customer_name or "Unknown",
            phone=installation.phone,
            email=installation.email,
            vehicle_number=installation.vehicle_number,
            vehicle_make=installation.vehicle_make,
            vehicle_model=installation.vehicle_model,
            product_serial=installation.product_serial,
            issue_type="Vehicle Delivery",
            issue_description=f"Auto-generated from successful installation {installation.reference}.",
            notes=f"Installation: {installation.reference}\nTechnician: {getattr(installation, 'technician_name', 'N/A')}",
            created_by=installation.created_by,
            custom_data={"source": "installation", "installation_id": installation.id, "warranty_status": "Pending"}
        )
        
        db.add(ticket)
        db.commit()
        db.refresh(ticket)
        print(f"DEBUG: SUCCESSFULLY created Care Ticket: {ref}")
        return ticket
    except Exception as e:
        print(f"DEBUG ERROR: Failed to auto-create Care ticket: {str(e)}")
        db.rollback()
        return None
