from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import auth, users, branches, departments, roles, modules, crm, installation, installationlayout, service, studio, dashboard, audit, warranty, crm_layout

app = FastAPI(title="OmniERP API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.get("/")
def root():
    return {"message": "OmniERP API Running"}
