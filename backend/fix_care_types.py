from app.database import SessionLocal
from app.models import KonwertCareTicket

def fix_types():
    db = SessionLocal()
    try:
        # Find all tickets that have an installation_id in custom_data but no issue_type
        tickets = db.query(KonwertCareTicket).all()
        count = 0
        for t in tickets:
            cd = t.custom_data or {}
            # If it came from an installation, it's a Vehicle Delivery
            if cd.get('source') == 'installation' or cd.get('installation_id'):
                if not t.issue_type:
                    t.issue_type = "Vehicle Delivery"
                    count += 1
        
        db.commit()
        print(f"Successfully patched {count} Konwert Care tickets.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    fix_types()
