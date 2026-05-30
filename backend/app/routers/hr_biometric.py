from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Response
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
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

class PunchRecord(BaseModel):
    user_id: str
    timestamp: str   # ISO format: 2024-01-15T09:30:00
    punch_type: Optional[int] = 0

class ImportPayload(BaseModel):
    machine_id: int
    punches: List[PunchRecord]

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
    return [serialize(m) for m in db.query(HRBiometricMachine).filter(HRBiometricMachine.is_active == True).all()]

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


# ── Employee Biometric ID Mapping ─────────────────────────────────────────────
@router.get("/employees")
def list_biometric_employees(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Returns all active employees with their biometric_id for the sync script reference."""
    employees = db.query(HREmployee).filter(HREmployee.is_active == True).all()
    return [
        {
            "id": e.id,
            "name": e.name,
            "employee_id": e.employee_id,
            "biometric_id": e.biometric_id,
        }
        for e in employees
    ]


# ── Import Punches from Local Sync Script ─────────────────────────────────────
@router.post("/import")
def import_punches(payload: ImportPayload, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    """
    Accepts raw punch records from the local sync script.
    Maps each record to an employee via biometric_id, deduplicates,
    creates HRAttendancePunch records, and recomputes daily attendance.
    """
    machine = db.query(HRBiometricMachine).filter(
        HRBiometricMachine.id == payload.machine_id,
        HRBiometricMachine.is_active == True
    ).first()
    if not machine:
        raise HTTPException(404, "Machine not found or inactive")

    imported = 0
    skipped = 0
    unmatched_ids = set()
    affected = set()

    for punch in payload.punches:
        # Parse timestamp
        try:
            ts = datetime.fromisoformat(punch.timestamp)
        except Exception:
            skipped += 1
            continue

        # Match employee by biometric_id
        emp = db.query(HREmployee).filter(
            HREmployee.biometric_id == str(punch.user_id),
            HREmployee.is_active == True
        ).first()
        if not emp:
            unmatched_ids.add(punch.user_id)
            continue

        # Dedup: skip if exact same punch already exists
        raw_uid = f"{machine.id}_{punch.user_id}_{punch.timestamp}"
        existing = db.query(HRAttendancePunch).filter(
            HRAttendancePunch.raw_punch_uid == raw_uid
        ).first()
        if existing:
            skipped += 1
            continue

        db.add(HRAttendancePunch(
            employee_id=emp.id,
            punch_time=ts,
            source="biometric",
            machine_id=machine.id,
            raw_punch_uid=raw_uid,
        ))
        affected.add((emp.id, ts.date()))
        imported += 1

    db.commit()

    # Recompute attendance records for all affected employee/date pairs
    from app.routers.hr_attendance import compute_record
    for emp_id, att_date in affected:
        try:
            compute_record(db, emp_id, att_date)
        except Exception as e:
            print(f"[Biometric Import] compute_record failed for emp {emp_id} on {att_date}: {e}")

    # Update machine sync stats
    machine.last_sync_at = datetime.utcnow()
    machine.last_sync_status = "success"
    machine.last_sync_count = (machine.last_sync_count or 0) + imported
    db.commit()

    return {
        "imported": imported,
        "skipped": skipped,
        "unmatched": sorted(list(unmatched_ids)),
        "message": f"Import complete: {imported} new punch(es), {skipped} skipped (duplicates)."
    }


# ── Generate Sync Script ──────────────────────────────────────────────────────
@router.get("/generate-script/{machine_id}")
def generate_sync_script(machine_id: int, db: Session = Depends(get_db),
                         current_user: User = Depends(get_current_user)):
    """
    Generates and returns a ready-to-run Python sync script for the given machine.
    Admin downloads and runs this on any PC on the same local network as the biometric device.
    Dependencies: pip install pyzk requests
    """
    m = db.query(HRBiometricMachine).filter(
        HRBiometricMachine.id == machine_id,
        HRBiometricMachine.is_active == True
    ).first()
    if not m:
        raise HTTPException(404, "Machine not found")

    safe_name = m.name.replace(" ", "_").lower()
    generated_on = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    script = (
        '#!/usr/bin/env python3\n'
        '"""\n'
        f'KimERP Biometric Sync Script\n'
        f'Machine  : {m.name}\n'
        f'Device IP: {m.ip_address}:{m.port}\n'
        f'Generated: {generated_on}\n'
        '\n'
        'INSTRUCTIONS:\n'
        '  1. Run this on a computer on the SAME local network as the biometric device.\n'
        '  2. Install dependencies once:\n'
        '       pip install pyzk requests\n'
        '  3. Run:\n'
        f'       python sync_{safe_name}.py\n'
        '  4. Enter your KimERP admin credentials when prompted.\n'
        '"""\n'
        '\n'
        'import sys\n'
        'import requests\n'
        'from datetime import datetime\n'
        '\n'
        'SERVER_URL   = "https://kimerp.ddns.net/api"\n'
        f'MACHINE_ID   = {m.id}\n'
        f'MACHINE_IP   = "{m.ip_address}"\n'
        f'MACHINE_PORT = {m.port}\n'
        '\n'
        '\n'
        'def login():\n'
        '    print("=" * 55)\n'
        f'    print("  KimERP Biometric Sync  |  {m.name}")\n'
        '    print("=" * 55)\n'
        '    print(f"  Device : {MACHINE_IP}:{MACHINE_PORT}")\n'
        '    print(f"  Server : {SERVER_URL}")\n'
        '    print()\n'
        '    username = input("Username (email): ").strip()\n'
        '    password = input("Password        : ").strip()\n'
        '    try:\n'
        '        res = requests.post(\n'
        '            f"{SERVER_URL}/auth/login",\n'
        '            data={"username": username, "password": password},\n'
        '            timeout=15\n'
        '        )\n'
        '        res.raise_for_status()\n'
        '        token = res.json().get("access_token")\n'
        '        if not token:\n'
        '            print("\\n❌ Login failed: No token received.")\n'
        '            sys.exit(1)\n'
        '        print("\\n✅ Login successful.\\n")\n'
        '        return token\n'
        '    except requests.exceptions.RequestException as e:\n'
        '        print(f"\\n❌ Login failed: {e}")\n'
        '        sys.exit(1)\n'
        '\n'
        '\n'
        'def fetch_from_device():\n'
        '    print(f"Connecting to biometric device at {MACHINE_IP}:{MACHINE_PORT} ...")\n'
        '    try:\n'
        '        from zk import ZK\n'
        '    except ImportError:\n'
        '        print("\\n❌ pyzk not installed. Run: pip install pyzk")\n'
        '        sys.exit(1)\n'
        '\n'
        '    zk = ZK(MACHINE_IP, port=MACHINE_PORT, timeout=15, password=0, force_udp=False, ommit_ping=False)\n'
        '    conn = None\n'
        '    try:\n'
        '        conn = zk.connect()\n'
        '        conn.disable_device()\n'
        '        attendances = conn.get_attendance()\n'
        '        conn.enable_device()\n'
        '        print(f"✅ Fetched {len(attendances)} punch record(s) from device.")\n'
        '        return attendances\n'
        '    except Exception as e:\n'
        '        print(f"\\n❌ Device connection failed: {e}")\n'
        '        print("   Make sure you are on the same local network as the device.")\n'
        '        sys.exit(1)\n'
        '    finally:\n'
        '        try:\n'
        '            if conn:\n'
        '                conn.disconnect()\n'
        '        except Exception:\n'
        '            pass\n'
        '\n'
        '\n'
        'def upload_to_server(token, attendances):\n'
        '    punches = []\n'
        '    for att in attendances:\n'
        '        try:\n'
        '            punches.append({\n'
        '                "user_id": str(att.user_id),\n'
        '                "timestamp": att.timestamp.isoformat(),\n'
        '                "punch_type": getattr(att, "status", 0),\n'
        '            })\n'
        '        except Exception:\n'
        '            pass\n'
        '\n'
        '    print(f"Uploading {len(punches)} punch record(s) to KimERP server ...")\n'
        '    try:\n'
        '        res = requests.post(\n'
        '            f"{SERVER_URL}/hr/biometric/import",\n'
        '            json={"machine_id": MACHINE_ID, "punches": punches},\n'
        '            headers={"Authorization": f"Bearer {token}"},\n'
        '            timeout=60\n'
        '        )\n'
        '        res.raise_for_status()\n'
        '        data = res.json()\n'
        '        print()\n'
        '        print("=" * 55)\n'
        '        print("  SYNC COMPLETE")\n'
        '        print("=" * 55)\n'
        '        print(f"  Imported  : {data.get(\'imported\', 0)} new punch(es)")\n'
        '        print(f"  Skipped   : {data.get(\'skipped\', 0)} (already exist)")\n'
        '        if data.get("unmatched"):\n'
        '            print(f"  Unmatched : Device user IDs with no employee mapping:")\n'
        '            for uid in data["unmatched"]:\n'
        '                print(f"              → Device User ID: {uid}")\n'
        '            print("  Fix: Set the Biometric ID field in Employee Master for these users.")\n'
        '        print()\n'
        '    except requests.exceptions.RequestException as e:\n'
        '        print(f"\\n❌ Upload failed: {e}")\n'
        '        if hasattr(e, "response") and e.response is not None:\n'
        '            print(f"   Server response: {e.response.text}")\n'
        '        sys.exit(1)\n'
        '\n'
        '\n'
        'if __name__ == "__main__":\n'
        '    token = login()\n'
        '    attendances = fetch_from_device()\n'
        '    upload_to_server(token, attendances)\n'
        '    input("Press Enter to exit...")\n'
    )

    filename = f"sync_{safe_name}.py"
    return Response(
        content=script,
        media_type="text/plain",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


# ── Sync Log ──────────────────────────────────────────────────────────────────
@router.get("/sync-log")
def sync_log(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    machines = db.query(HRBiometricMachine).filter(HRBiometricMachine.is_active == True).all()
    return [{
        "id": m.id, "name": m.name, "ip_address": m.ip_address,
        "last_sync_at": str(m.last_sync_at) if m.last_sync_at else None,
        "last_sync_status": m.last_sync_status,
        "last_sync_count": m.last_sync_count,
    } for m in machines]


# ── Legacy: Background Sync (kept for scheduler compatibility) ────────────────
def _do_sync(machine_id: int):
    """Background task that connects to ZKTeco machine and pulls attendance logs directly (server-side)."""
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
                emp = db.query(HREmployee).filter(HREmployee.biometric_id == str(att.user_id)).first()
                if not emp:
                    continue
                raw_uid = f"{machine.id}_{att.user_id}_{att.timestamp}"
                existing = db.query(HRAttendancePunch).filter(HRAttendancePunch.raw_punch_uid == raw_uid).first()
                if existing:
                    continue
                db.add(HRAttendancePunch(
                    employee_id=emp.id, punch_time=att.timestamp,
                    source="biometric", machine_id=machine.id, raw_punch_uid=raw_uid,
                ))
                count += 1
            db.commit()
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
