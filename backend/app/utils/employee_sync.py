import json
import logging
import threading
from datetime import datetime
from typing import Optional, Dict, Any, List
import requests
from sqlalchemy.orm import Session
from app.database import SessionLocal

logger = logging.getLogger(__name__)

DEFAULT_SETTINGS = {
    "enabled": False,
    "webhook_url": "",
    "auth_token": "",
    "auth_header": "Authorization",
    "sync_on_create": True,
    "sync_on_update": True,
    "sync_on_delete": True,
    "last_sync_at": None,
    "last_sync_status": None,
    "last_sync_error": None,
}

def get_sync_settings(db: Session = None) -> Dict[str, Any]:
    """Retrieve employee sync configuration from database."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True
        
    try:
        from app.hr_models import HRConfig
        setting = db.query(HRConfig).filter(HRConfig.key == "employee_sync_settings").first()
        if not setting or not isinstance(setting.value, dict):
            # Check fallback SystemSetting
            from app.models import SystemSetting
            sys_setting = db.query(SystemSetting).filter(SystemSetting.key == "employee_sync_settings").first()
            if sys_setting and isinstance(sys_setting.value, dict):
                merged = {**DEFAULT_SETTINGS, **sys_setting.value}
                return merged
            return DEFAULT_SETTINGS.copy()
            
        merged = {**DEFAULT_SETTINGS, **setting.value}
        return merged
    finally:
        if should_close:
            db.close()

def save_sync_settings(settings_data: Dict[str, Any], db: Session = None) -> Dict[str, Any]:
    """Persist employee sync configuration to database."""
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        from app.hr_models import HRConfig
        from app.models import SystemSetting

        current = get_sync_settings(db)
        updated = {**current, **settings_data}
        
        # Save in HRConfig
        hr_cfg = db.query(HRConfig).filter(HRConfig.key == "employee_sync_settings").first()
        if hr_cfg:
            hr_cfg.value = updated
            hr_cfg.updated_at = datetime.utcnow()
        else:
            hr_cfg = HRConfig(key="employee_sync_settings", value=updated)
            db.add(hr_cfg)

        # Mirror in SystemSetting
        sys_cfg = db.query(SystemSetting).filter(SystemSetting.key == "employee_sync_settings").first()
        if sys_cfg:
            sys_cfg.value = updated
        else:
            sys_cfg = SystemSetting(key="employee_sync_settings", value=updated)
            db.add(sys_cfg)

        db.commit()
        return updated
    finally:
        if should_close:
            db.close()

def _update_sync_status(status: str, error: Optional[str] = None):
    """Internal helper to record the last sync execution timestamp and status."""
    try:
        db = SessionLocal()
        from app.hr_models import HRConfig
        hr_cfg = db.query(HRConfig).filter(HRConfig.key == "employee_sync_settings").first()
        if hr_cfg and isinstance(hr_cfg.value, dict):
            val = hr_cfg.value.copy()
            val["last_sync_at"] = datetime.utcnow().isoformat() + "Z"
            val["last_sync_status"] = status
            val["last_sync_error"] = error
            hr_cfg.value = val
            hr_cfg.updated_at = datetime.utcnow()
            db.commit()
        db.close()
    except Exception as e:
        logger.error(f"Failed to update sync status: {e}")

def send_webhook_payload(
    url: str,
    payload: Dict[str, Any],
    auth_token: Optional[str] = None,
    auth_header: str = "Authorization",
    timeout: int = 10
) -> tuple[bool, int, str]:
    """
    Sends an HTTP POST webhook request to the configured destination.
    Returns (success: bool, status_code: int, response_message: str).
    """
    if not url or not url.strip().startswith(("http://", "https://")):
        return False, 0, "Invalid or empty Webhook URL"

    headers = {
        "Content-Type": "application/json",
        "User-Agent": "OmniERP-EmployeeSync/1.0"
    }

    if auth_token and auth_token.strip():
        token = auth_token.strip()
        header_name = auth_header.strip() if auth_header else "Authorization"
        if header_name.lower() == "authorization" and not token.lower().startswith("bearer "):
            headers[header_name] = f"Bearer {token}"
        else:
            headers[header_name] = token

    try:
        response = requests.post(url.strip(), json=payload, headers=headers, timeout=timeout)
        success = (200 <= response.status_code < 300)
        resp_text = response.text[:500] if response.text else f"HTTP {response.status_code}"
        return success, response.status_code, resp_text
    except requests.exceptions.RequestException as e:
        logger.warning(f"Employee sync webhook failed to reach {url}: {e}")
        return False, 0, str(e)

def test_sync_webhook(
    url: str,
    auth_token: Optional[str] = None,
    auth_header: str = "Authorization"
) -> Dict[str, Any]:
    """Sends a test ping to verify endpoint connectivity and credentials."""
    payload = {
        "event": "test.ping",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "source": "Omni ERP",
        "message": "Connection test ping from Omni ERP Employee Sync"
    }
    success, status_code, msg = send_webhook_payload(
        url=url,
        payload=payload,
        auth_token=auth_token,
        auth_header=auth_header,
        timeout=10
    )
    return {
        "success": success,
        "status_code": status_code,
        "message": "Webhook reached successfully" if success else f"Webhook delivery failed: {msg}",
        "raw_response": msg
    }

def _async_dispatch_worker(event: str, data: Dict[str, Any]):
    """Background worker function executed in a separate daemon thread."""
    try:
        settings = get_sync_settings()
        if not settings.get("enabled"):
            return

        webhook_url = settings.get("webhook_url", "").strip()
        if not webhook_url:
            return

        if event == "employee.created" and not settings.get("sync_on_create", True):
            return
        if event == "employee.updated" and not settings.get("sync_on_update", True):
            return
        if event == "employee.deleted" and not settings.get("sync_on_delete", True):
            return

        payload = {
            "event": event,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "source": "Omni ERP",
            "data": data
        }

        success, status_code, response_text = send_webhook_payload(
            url=webhook_url,
            payload=payload,
            auth_token=settings.get("auth_token"),
            auth_header=settings.get("auth_header", "Authorization")
        )

        status_str = "SUCCESS" if success else "FAILED"
        err_msg = None if success else f"HTTP {status_code}: {response_text}"
        _update_sync_status(status=status_str, error=err_msg)

        if not success:
            logger.warning(f"Employee sync event '{event}' failed: {err_msg}")
        else:
            logger.info(f"Employee sync event '{event}' delivered successfully (HTTP {status_code})")

    except Exception as e:
        logger.error(f"Error in employee sync background worker: {e}", exc_info=True)
        _update_sync_status(status="FAILED", error=str(e))

def dispatch_employee_sync(event: str, employee_data: Dict[str, Any]):
    """
    Non-blocking trigger for employee sync webhook events.
    Spawns a background thread to prevent blocking or failing the main ERP request.
    """
    t = threading.Thread(
        target=_async_dispatch_worker,
        args=(event, employee_data),
        daemon=True,
        name=f"emp-sync-{event}"
    )
    t.start()

def sync_all_employees_to_webhook(db: Session, batch: bool = True) -> Dict[str, Any]:
    """
    Pushes all active employee records to the configured webhook URL.
    Can send as a single batch event or individual records.
    """
    settings = get_sync_settings(db)
    if not settings.get("enabled"):
        return {"success": False, "message": "Employee sync is currently disabled in settings."}

    webhook_url = settings.get("webhook_url", "").strip()
    if not webhook_url:
        return {"success": False, "message": "No Webhook URL configured in Employee Sync settings."}

    from app.hr_models import HREmployee
    from app.routers.hr_employees import serialize

    employees = db.query(HREmployee).filter(HREmployee.is_active == True).order_by(HREmployee.name).all()
    serialized_employees = [serialize(e, is_admin=True) for e in employees]

    if batch:
        payload = {
            "event": "employee.sync_batch",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "source": "Omni ERP",
            "count": len(serialized_employees),
            "data": serialized_employees
        }
        success, status_code, response_text = send_webhook_payload(
            url=webhook_url,
            payload=payload,
            auth_token=settings.get("auth_token"),
            auth_header=settings.get("auth_header", "Authorization"),
            timeout=30
        )
        status_str = "SUCCESS" if success else "FAILED"
        err_msg = None if success else f"HTTP {status_code}: {response_text}"
        _update_sync_status(status=status_str, error=err_msg)

        return {
            "success": success,
            "count": len(serialized_employees),
            "status_code": status_code,
            "message": f"Successfully synced {len(serialized_employees)} employees." if success else f"Sync failed: {err_msg}"
        }
    else:
        # Send sequentially
        success_count = 0
        fail_count = 0
        for emp_dict in serialized_employees:
            payload = {
                "event": "employee.created",
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "source": "Omni ERP",
                "data": emp_dict
            }
            s, _, _ = send_webhook_payload(
                url=webhook_url,
                payload=payload,
                auth_token=settings.get("auth_token"),
                auth_header=settings.get("auth_header", "Authorization"),
                timeout=10
            )
            if s: success_count += 1
            else: fail_count += 1

        overall = (fail_count == 0)
        _update_sync_status(
            status="SUCCESS" if overall else "PARTIAL",
            error=None if overall else f"{fail_count} employees failed to sync"
        )
        return {
            "success": overall,
            "total": len(serialized_employees),
            "synced": success_count,
            "failed": fail_count,
            "message": f"Synced {success_count}/{len(serialized_employees)} employees."
        }
