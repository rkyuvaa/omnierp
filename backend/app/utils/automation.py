from datetime import datetime
import logging

def trigger_konwert_care_handoff(installation, db):
    """
    Automatically creates a Konwert Care+ ticket when an installation is completed.
    """
    from ..models import KonwertCareTicket, Installation, Stage
    try:
        print(f"[Automation] >>> START check for Installation ID: {getattr(installation, 'id', 'ERR')}")
        
        # 1. Fetch stage name
        stage_name = "Unknown"
        if installation.stage_id:
            stage = db.query(Stage).filter(Stage.id == installation.stage_id).first()
            if stage: stage_name = stage.name
            
        print(f"[Automation] Stage Name: '{stage_name}' (ID: {installation.stage_id})")
        
        # 2. Fuzzy match stage
        target_names = ["fitment done", "completed", "done", "delivered", "fitment completed", "ready"]
        if not any(n in stage_name.lower() for n in target_names):
            print(f"[Automation] Stage is NOT a trigger. STOP.")
            return None

        # 3. Duplicate check
        print(f"[Automation] Checking for duplicates...")
        existing_tickets = db.query(KonwertCareTicket).all()
        for et in existing_tickets:
            if et.custom_data and str(et.custom_data.get('installation_id')) == str(installation.id):
                print(f"[Automation] Duplicate found: CARE Ticket {et.reference}. STOP.")
                return None
            
        # 4. Reference generation
        last = db.query(KonwertCareTicket).order_by(KonwertCareTicket.id.desc()).first()
        next_id = (last.id + 1) if last else 1
        ref = f"CARE/{datetime.now().year}/{next_id:04d}"
        print(f"[Automation] Generated Ref: {ref}")
        
        # 5. Data Gathering
        cd = installation.custom_data or {}
        # Safely get contact info from multiple possible keys or attributes
        phone = getattr(installation, 'phone', cd.get('phone', cd.get('customer_phone', 'N/A')))
        email = getattr(installation, 'email', cd.get('email', cd.get('customer_email', 'N/A')))
        
        # Handle Product Serial
        prod_serial = getattr(installation, 'product_serial', cd.get('product_serial'))
        if not prod_serial and installation.product_id:
            from ..models import Product
            prod = db.query(Product).filter(Product.id == installation.product_id).first()
            if prod: prod_serial = prod.serial_number
            
        print(f"[Automation] Data Check - Customer: {installation.customer_name}, Phone: {phone}, Serial: {prod_serial}")

        # 6. Create Ticket
        ticket = KonwertCareTicket(
            reference=ref,
            customer_name=installation.customer_name or "New Customer",
            phone=phone,
            email=email,
            vehicle_number=installation.vehicle_number,
            vehicle_make=installation.vehicle_make,
            vehicle_model=installation.vehicle_model,
            product_serial=prod_serial,
            issue_type="Vehicle Delivery",
            issue_description=f"Automated handoff from Installation {installation.reference}.",
            notes=f"Installation: {installation.reference}\nNotes: {installation.notes or ''}",
            created_by=installation.created_by or 1,
            custom_data={"source": "installation", "installation_id": installation.id, "warranty_status": "Pending"}
        )
        
        db.add(ticket)
        db.commit()
        db.refresh(ticket)
        print(f"[Automation] >>> SUCCESS! Created Ticket: {ref}")
        return ticket
    except Exception as e:
        import traceback
        print(f"[Automation] !!! ERROR: {str(e)}")
        traceback.print_exc()
        db.rollback()
        return None
