"""
Background jobs for Attendance & HR module.
- Auto-approval of leave/on-duty after 6 hours
- Biometric machine sync every 10 minutes
"""
from datetime import datetime
from app.database import SessionLocal
from app.hr_models import HRLeaveRequest, HROnDutyRequest, HRBiometricMachine, HRNotification, HRAttendanceRecord, HRLeaveBalance


def auto_approve_leaves():
    """Auto-approve leave requests that have passed the 6-hour window"""
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        pending = db.query(HRLeaveRequest).filter(
            HRLeaveRequest.status == "pending",
            HRLeaveRequest.auto_approve_at <= now,
        ).all()

        for req in pending:
            req.status = "auto_approved"
            req.is_auto_approved = True
            req.approved_at = now

            # Deduct balance
            if req.leave_type and req.leave_type.code != "LOP":
                from app.hr_models import HRLeaveBalance
                balance = db.query(HRLeaveBalance).filter(
                    HRLeaveBalance.employee_id == req.employee_id,
                    HRLeaveBalance.leave_type_id == req.leave_type_id,
                    HRLeaveBalance.year == req.from_date.year
                ).first()
                if balance:
                    balance.used_days += req.total_days

            # Update attendance records
            from datetime import timedelta
            current_date = req.from_date
            while current_date <= req.to_date:
                record = db.query(HRAttendanceRecord).filter(
                    HRAttendanceRecord.employee_id == req.employee_id,
                    HRAttendanceRecord.date == current_date
                ).first()
                if not record:
                    record = HRAttendanceRecord(employee_id=req.employee_id, date=current_date)
                    db.add(record)
                record.status = "leave"
                current_date += timedelta(days=1)

            # Notify employee
            if req.employee and req.employee.user_id:
                notif = HRNotification(
                    user_id=req.employee.user_id,
                    title="Leave Auto-Approved ⏰",
                    message=f"Your {req.leave_type.name if req.leave_type else 'leave'} from {req.from_date} to {req.to_date} was auto-approved as no action was taken within 6 hours.",
                    reference_type="leave", reference_id=req.id
                )
                db.add(notif)

            # Notify approver
            if req.approver and req.approver.user_id:
                notif = HRNotification(
                    user_id=req.approver.user_id,
                    title="Leave Auto-Approved ⏰",
                    message=f"{req.employee.name if req.employee else 'An employee'}'s leave request was auto-approved because no action was taken within 6 hours.",
                    reference_type="leave", reference_id=req.id
                )
                db.add(notif)

            print(f"[AutoApprove] Leave {req.reference} auto-approved")

        # Auto-approve on-duty requests
        pending_od = db.query(HROnDutyRequest).filter(
            HROnDutyRequest.status == "pending",
            HROnDutyRequest.auto_approve_at <= now,
        ).all()

        for req in pending_od:
            req.status = "auto_approved"
            req.is_auto_approved = True
            req.approved_at = now

            # Update attendance record
            record = db.query(HRAttendanceRecord).filter(
                HRAttendanceRecord.employee_id == req.employee_id,
                HRAttendanceRecord.date == req.date
            ).first()
            if not record:
                record = HRAttendanceRecord(employee_id=req.employee_id, date=req.date)
                db.add(record)
            record.status = "on_duty"
            record.onduty_request_id = req.id

            if req.employee and req.employee.user_id:
                db.add(HRNotification(
                    user_id=req.employee.user_id,
                    title="On-Duty Auto-Approved ⏰",
                    message=f"Your On-Duty for {req.date} was auto-approved (no action in 6 hours).",
                    reference_type="onduty", reference_id=req.id
                ))
            print(f"[AutoApprove] On-Duty {req.reference} auto-approved")

        db.commit()
    except Exception as e:
        print(f"[AutoApprove] Error: {e}")
        db.rollback()
    finally:
        db.close()


def sync_all_biometric_machines():
    """Pull attendance from all active biometric machines"""
    db = SessionLocal()
    try:
        machines = db.query(HRBiometricMachine).filter(HRBiometricMachine.is_active == True).all()
        machine_ids = [m.id for m in machines]
        db.close()

        from app.routers.hr_biometric import _do_sync
        for machine_id in machine_ids:
            try:
                _do_sync(machine_id)
            except Exception as e:
                print(f"[BiometricSync] Machine {machine_id} error: {e}")
    except Exception as e:
        print(f"[BiometricSync] Error fetching machines: {e}")
    finally:
        if not db.is_active:
            pass
        else:
            db.close()


def start_scheduler():
    """Start APScheduler background jobs"""
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        scheduler = BackgroundScheduler()
        # Auto-approve check every 5 minutes
        scheduler.add_job(auto_approve_leaves, 'interval', minutes=5, id='auto_approve_leaves')
        # Biometric sync every 10 minutes
        scheduler.add_job(sync_all_biometric_machines, 'interval', minutes=10, id='biometric_sync')
        scheduler.start()
        print("[Scheduler] HR background jobs started")
        return scheduler
    except Exception as e:
        print(f"[Scheduler] Failed to start: {e}")
        return None
