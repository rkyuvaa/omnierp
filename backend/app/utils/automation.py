from datetime import datetime
import logging

def trigger_konwert_care_handoff(installation, db):
    """
    Automatically creates a Konwert Care+ ticket when an installation is completed.
    """
    from ..models import KonwertCareTicket, Installation, Stage
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

        # Check if a ticket already exists for THIS specific installation
        # Fetching all tickets and checking locally to be safe across DB types
        # (Since there aren't thousands of tickets yet, this is very fast)
        existing_tickets = db.query(KonwertCareTicket).all()
        existing = None
        for et in existing_tickets:
            if et.custom_data and str(et.custom_data.get('installation_id')) == str(installation.id):
                existing = et
                break
        
        if existing:
            print(f"DEBUG: Ticket already exists for Installation ID {installation.id}. skipping.")
            return None
            
        # Fallback check for Vehicle Number
        if installation.vehicle_number:
            existing_v = db.query(KonwertCareTicket).filter(
                KonwertCareTicket.vehicle_number == installation.vehicle_number
            ).first()
            if existing_v:
                print(f"DEBUG: Vehicle {installation.vehicle_number} already in Care+. skipping.")
                return None
            
        # Generate Reference
        last = db.query(KonwertCareTicket).order_by(KonwertCareTicket.id.desc()).first()
        next_id = (last.id + 1) if last else 1
        ref = f"CARE/{datetime.now().year}/{next_id:04d}"
        
        # Create Ticket
        # Try to get phone/email from custom_data if not on the object
        cd = installation.custom_data or {}
        phone = getattr(installation, 'phone', cd.get('phone', cd.get('customer_phone')))
        email = getattr(installation, 'email', cd.get('email', cd.get('customer_email')))
        product_serial = getattr(installation, 'product_serial', cd.get('product_serial'))

        ticket = KonwertCareTicket(
            reference=ref,
            customer_name=installation.customer_name or "Unknown",
            phone=phone,
            email=email,
            vehicle_number=installation.vehicle_number,
            vehicle_make=installation.vehicle_make,
            vehicle_model=installation.vehicle_model,
            product_serial=product_serial,
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
