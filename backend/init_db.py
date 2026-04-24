from app.database import SessionLocal, engine, Base
from app.models import User, Role
from app.auth import hash_password
import sys

def init_fresh_db():
    print("Initializing fresh database...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        # Check if admin already exists
        existing_admin = db.query(User).filter(User.email == "admin@erp.com").first()
        if existing_admin:
            print("Admin user already exists. Skipping creation.")
            return

        # Create first user as Superadmin
        admin_user = User(
            email="admin@erp.com",
            name="Super Admin",
            hashed_password=hash_password("admin123"),
            is_active=True,
            is_superadmin=True
        )
        db.add(admin_user)
        db.commit()
        print("Fresh database initialized!")
        print("Login Email: admin@erp.com")
        print("Login Password: admin123")
        print("IMPORTANT: Change your password after logging in.")
        
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_fresh_db()
