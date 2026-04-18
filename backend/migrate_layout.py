from app.database import SessionLocal
from app.models import InstallationTab, InstallationField, CRMTab, CRMField

def migrate():
    db = SessionLocal()
    try:
        # Migrate Tabs
        i_tabs = db.query(InstallationTab).all()
        for it in i_tabs:
            # Check if already migrated
            existing = db.query(CRMTab).filter(CRMTab.name == it.name, CRMTab.module == "installation").first()
            if not existing:
                nt = CRMTab(name=it.name, module="installation", sort_order=it.sort_order, is_active=it.is_active)
                db.add(nt)
                db.flush()
                # Migrate Fields for this tab
                i_fields = db.query(InstallationField).filter(InstallationField.tab_id == it.id).all()
                for iff in i_fields:
                    nf = CRMField(
                        tab_id=nt.id,
                        module="installation",
                        field_name=iff.field_name,
                        field_label=iff.field_label,
                        field_type=iff.field_type,
                        placeholder=iff.placeholder,
                        options=iff.options,
                        required=iff.required,
                        width=iff.width,
                        visibility_rule=iff.visibility_rule,
                        sort_order=iff.sort_order,
                        is_active=iff.is_active
                    )
                    db.add(nf)
        db.commit()
        print("Migration successful: Installation layout moved to unified Dynamic Layout system.")
    except Exception as e:
        db.rollback()
        print(f"Migration failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
