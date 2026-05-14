from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.database import get_db, SessionLocal
from app.models import User
from app.auth import get_current_user
from app.hr_models import HRBiometricMachine, HRAttendancePunch, HREmployee

router = APIRouter()

class MachineCreate(BaseModel):
    name: str
    ip_address: str
    port: int = 4370
    branch_id: Optional[int] = None

class MachineUpdate(BaseModel):
    name: Optional[str] = None
    ip_address: Optional[str] = None
    port: Optional[int] = None
    branch_id: Optional[int] = None
    is_active: Optional[bool] = None

def serialize(m: HRBiometricMachine):
    return {
        "id": m.id, "name": m.name,
        "ip_address": m.ip_address, "port": m.port,
        "branch_id": m.branch_id,
        "branch_name": m.branch.name if m.branch else None,
        "is_active": m.is_active,
        "last_sync_at": str(m.last_sync_at) if m.last_sync_at else None,
        "last_sync_status": m.last_sync_status,
        "last_sync_count": m.last_sync_count,
        "device_serial": m.device_serial,
    }

# ── Machine CRUD ──────────────────────────────────────────────────────────────
@router.get("/machines")
def list_machines(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return [serialize(m) for m in db.query(HRBiometricMachine).all()]

@router.post("/machines")
def add_machine(data: MachineCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    machine = HRBiometricMachine(**data.model_dump())
    db.add(machine); db.commit(); db.refresh(machine)
    return serialize(machine)

@router.put("/machines/{machine_id}")
def update_machine(machine_id: int, data: MachineUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    m = db.query(HRBiometricMachine).filter(HRBiometricMachine.id == machine_id).first()
    if not m: raise HTTPException(404, "Machine not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(m, k, v)
    db.commit(); db.refresh(m)
    return serialize(m)

@router.delete("/machines/{machine_id}")
def delete_machine(machine_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    m = db.query(HRBiometricMachine).filter(HRBiometricMachine.id == machine_id).first()
    if not m: raise HTTPException(404, "Machine not found")
    m.is_active = False; db.commit()
    return {"message": "Deactivated"}

# ── Sync Logic (eSSL / ZK Protocol via pyzk) ─────────────────────────────────
def _do_sync(machine_id: int):
    """Background task that connects to eSSL machine and pulls attendance logs"""
    db = SessionLocal()
    try:
        machine = db.query(HRBiometricMachine).filter(HRBiometricMachine.id == machine_id).first()
        if not machine or not machine.is_active:
            return

        try:
            from zk import ZK, const
            zk = ZK(machine.ip_address, port=machine.port, timeout=10, password=0, force_udp=False, ommit_ping=False)
            conn = zk.connect()
            conn.disable_device()

            attendances = conn.get_attendance()
            conn.enable_device()
            conn.disconnect()

            count = 0
            for att in attendances:
                # Match employee by biometric user ID
                emp = db.query(HREmployee).filter(
                    HREmployee.biometric_id == str(att.user_id)
                ).first()
                if not emp:
                    continue

                # Dedup: skip if exact same punch already exists
                raw_uid = f"{machine.id}_{att.user_id}_{att.timestamp}"
                existing = db.query(HRAttendancePunch).filter(
                    HRAttendancePunch.raw_punch_uid == raw_uid
                ).first()
                if existing:
                    continue

                punch = HRAttendancePunch(
                    employee_id=emp.id,
                    punch_time=att.timestamp,
                    source="biometric",
                    machine_id=machine.id,
                    raw_punch_uid=raw_uid,
                )
                db.add(punch)
                count += 1

            db.commit()

            # Recompute attendance records for affected employees/dates
            from app.routers.hr_attendance import compute_record
            affected = set()
            for att in attendances:
                emp = db.query(HREmployee).filter(HREmployee.biometric_id == str(att.user_id)).first()
                if emp:
                    affected.add((emp.id, att.timestamp.date()))
            for emp_id, att_date in affected:
                compute_record(db, emp_id, att_date)

            machine.last_sync_at = datetime.utcnow()
            machine.last_sync_status = "success"
            machine.last_sync_count = count
            db.commit()

        except Exception as e:
            machine.last_sync_at = datetime.utcnow()
            machine.last_sync_status = "failed"
            db.commit()
            print(f"[Biometric Sync] Machine {machine.id} failed: {e}")

    finally:
        db.close()

@router.post("/sync/{machine_id}")
def manual_sync(machine_id: int, background_tasks: BackgroundTasks,
                db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    m = db.query(HRBiometricMachine).filter(HRBiometricMachine.id == machine_id).first()
    if not m: raise HTTPException(404, "Machine not found")
    background_tasks.add_task(_do_sync, machine_id)
    return {"message": f"Sync started for {m.name}"}

@router.post("/test-connection")
def test_connection(data: MachineCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Tries to connect to a machine and returns success or error immediately"""
    try:
        from zk import ZK
        # Use a very short timeout for "Test Connection"
        zk = ZK(data.ip_address, port=data.port, timeout=5)
        conn = None
        try:
            conn = zk.connect()
            # If connected, fetch serial number as a test
            sn = conn.get_serialnumber()
            conn.disconnect()
            return {"success": True, "message": f"Connection Successful! Serial: {sn}"}
        except Exception as e:
            if conn: conn.disconnect()
            return {"success": False, "message": f"Connection Failed: {str(e)}"}
    except Exception as e:
        return {"success": False, "message": f"Could not initialize ZK library: {str(e)}"}


@router.get("/sync-log")
def sync_log(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    machines = db.query(HRBiometricMachine).all()
    return [{
        "id": m.id, "name": m.name, "ip_address": m.ip_address,
        "last_sync_at": str(m.last_sync_at) if m.last_sync_at else None,
        "last_sync_status": m.last_sync_status,
        "last_sync_count": m.last_sync_count,
    } for m in machines]
