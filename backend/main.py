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

# from patch_db import patch_db
# patch_db()

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


from fastapi.responses import FileResponse

# Ensure static/uploads exists
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
static_dir = os.path.join(BASE_DIR, "static")
upload_dir = os.path.join(static_dir, "uploads")

if not os.path.exists(upload_dir):
    os.makedirs(upload_dir, exist_ok=True)

@app.get("/api/uploads/{filename}")
@app.get("/api/static/uploads/{filename}")
@app.get("/uploads/{filename}")
def serve_upload(filename: str):
    file_path = os.path.join(upload_dir, filename)
    print(f"DEBUG: Serving file from {file_path}")
    if not os.path.isfile(file_path):
        print(f"DEBUG: File NOT FOUND at {file_path}")
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(file_path)

# Keep the general static mount for other things
app.mount("/api/static", StaticFiles(directory=static_dir), name="static")


@app.get("/")
def root():
    return {"message": "OmniERP API Running"}

@app.get("/api/debug/uploads")
def debug_uploads():
    if not os.path.exists(upload_dir):
        return {"error": "Upload directory does not exist", "path": upload_dir}
    files = os.listdir(upload_dir)
    return {"path": upload_dir, "files": files}
