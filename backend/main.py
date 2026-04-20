from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from fastapi.staticfiles import StaticFiles
import os
from app.routers import auth, users, branches, departments, roles, modules, crm, installation, installationlayout, service, studio, dashboard, audit, warranty, crm_layout, forms, konwertcare

app = FastAPI(title="OmniERP API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

from patch_db import patch_db
patch_db()

Base.metadata.create_all(bind=engine)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(branches.router, prefix="/api/branches", tags=["branches"])
app.include_router(departments.router, prefix="/api/departments", tags=["departments"])
app.include_router(roles.router, prefix="/api/roles", tags=["roles"])
app.include_router(modules.router, prefix="/api/modules", tags=["modules"])
app.include_router(crm.router, prefix="/api/crm", tags=["crm"])
app.include_router(installation.router, prefix="/api/installation", tags=["installation"])
app.include_router(installationlayout.router, prefix="/api/installation/layout", tags=["installation-layout"])
app.include_router(service.router, prefix="/api/service", tags=["service"])
app.include_router(studio.router, prefix="/api/studio", tags=["studio"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(audit.router, prefix="/api/audit", tags=["audit"])
app.include_router(warranty.router, prefix="/api/warranty", tags=["warranty"])
app.include_router(crm_layout.router, prefix="/api/crm-layout", tags=["crm-layout"])
app.include_router(forms.router, prefix="/api/forms", tags=["Forms"])
app.include_router(konwertcare.router, prefix="/api/konwertcare", tags=["konwertcare"])


# Ensure static/uploads exists
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
static_dir = os.path.join(BASE_DIR, "static")
upload_dir = os.path.join(static_dir, "uploads")

if not os.path.exists(upload_dir):
    os.makedirs(upload_dir)

app.mount("/api/static", StaticFiles(directory=static_dir), name="static")

@app.get("/api/debug-files")
def debug_files():
    import os
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    static_path = os.path.join(BASE_DIR, "static")
    upload_path = os.path.join(static_path, "uploads")
    
    files = []
    if os.path.exists(upload_path):
        files = os.listdir(upload_path)
    
    # Scorched earth scout: check ALL of /home/ubuntu
    all_images = []
    # Search in erp and any other folders in ubuntu home
    search_root = "/home/ubuntu"
    try:
        for root, dirs, files in os.walk(search_root):
            if 'node_modules' in dirs: dirs.remove('node_modules')
            if '.git' in dirs: dirs.remove('.git')
            if 'dist' in dirs: dirs.remove('dist')
            
            for file in files:
                if file.lower().endswith(('.jpg', '.png', '.jpeg')):
                    all_images.append(os.path.join(root, file))
                    if len(all_images) >= 50: break # More samples
            if len(all_images) >= 50: break
    except Exception as e:
        return {"error": str(e)}
    
    return {
        "all_found_images": all_images,
        "cwd": os.getcwd()
    }

@app.get("/")
def root():
    return {"message": "OmniERP API Running"}
