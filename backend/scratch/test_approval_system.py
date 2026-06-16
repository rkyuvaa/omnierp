import os
import sys
from unittest.mock import MagicMock
import importlib.util

# 1. Setup mock modules to intercept imports and direct to SQLite in-memory
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Create a mock config/settings module
class MockSettings:
    DATABASE_URL = "sqlite:///:memory:"
    SECRET_KEY = "mock-secret-key"
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 480
    DISABLE_BIOMETRIC_SCHEDULER = True
    VAPID_PUBLIC_KEY = "mock"
    VAPID_PRIVATE_KEY = "mock"
    VAPID_EMAIL = "mailto:mock@mock.com"

settings = MockSettings()

# Mock app.config
app_config_mock = MagicMock()
app_config_mock.settings = settings
sys.modules['app.config'] = app_config_mock

# Setup mock database with in-memory SQLite
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

engine = create_engine("sqlite:///:memory:")
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class MockDatabaseModule:
    engine = engine
    SessionLocal = SessionLocal
    Base = Base
    def get_db(self):
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

db_module = MockDatabaseModule()
sys.modules['app.database'] = db_module

# Mock fastapi module
class MockHTTPException(Exception):
    def __init__(self, status_code, detail=None):
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"HTTP {status_code}: {detail}")

class MockAPIRouter:
    def post(self, *args, **kwargs):
        def decorator(func):
            return func
        return decorator
    def get(self, *args, **kwargs):
        def decorator(func):
            return func
        return decorator
    def put(self, *args, **kwargs):
        def decorator(func):
            return func
        return decorator
    def delete(self, *args, **kwargs):
        def decorator(func):
            return func
        return decorator

fastapi_mock = MagicMock()
fastapi_mock.HTTPException = MockHTTPException
fastapi_mock.Depends = lambda x: x
fastapi_mock.APIRouter = MockAPIRouter
fastapi_mock.BackgroundTasks = MagicMock
sys.modules['fastapi'] = fastapi_mock
sys.modules['fastapi.responses'] = MagicMock()

# Mock app.auth
auth_mock = MagicMock()
auth_mock.get_current_user = lambda: None
auth_mock.require_admin = lambda: None
sys.modules['app.auth'] = auth_mock

# Mock app.utils.push_service
push_mock = MagicMock()
push_mock.send_push_to_user = lambda *args, **kwargs: None
sys.modules['app.utils.push_service'] = push_mock

# Mock app.utils.email_service
email_mock = MagicMock()
email_mock.send_template_email = lambda *args, **kwargs: None
sys.modules['app.utils.email_service'] = email_mock

# Mock app.routers and its child hr_config to avoid loading __init__.py which imports pyotp, etc.
app_routers_mock = MagicMock()
sys.modules['app.routers'] = app_routers_mock

hr_config_mock = MagicMock()
sys.modules['app.routers.hr_config'] = hr_config_mock
# Mock get_hr_config inside hr_config module mock
def mock_get_hr_config(db, key, default=None):
    return default
hr_config_mock.get_hr_config = mock_get_hr_config

# 2. Import all models so their metadata is registered with our Base
import app.models as models
import app.hr_models as hr_models

models.Base = Base
hr_models.Base = Base

# Create all tables in-memory SQLite
Base.metadata.create_all(bind=engine)

# Load routers directly via importlib to bypass package __init__
def load_module_from_file(module_name, file_path):
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module

hr_leave_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../app/routers/hr_leave.py"))
hr_leave = load_module_from_file("app.routers.hr_leave", hr_leave_path)

hr_onduty_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../app/routers/hr_onduty.py"))
hr_onduty = load_module_from_file("app.routers.hr_onduty", hr_onduty_path)

# Extract functions and schemas
approve_leave = hr_leave.approve_leave
reject_leave = hr_leave.reject_leave
LeaveAction = hr_leave.LeaveAction

approve_onduty = hr_onduty.approve_onduty
reject_onduty = hr_onduty.reject_onduty
OnDutyAction = hr_onduty.OnDutyAction

from app.models import User
from app.hr_models import HREmployee, HRLeaveType, HRLeaveBalance, HRLeaveRequest, HROnDutyRequest

# Setup a session
db = SessionLocal()

# Setup helper for background tasks
class MockBackgroundTasks:
    def __init__(self):
        self.tasks = []
    def add_task(self, func, *args, **kwargs):
        self.tasks.append((func, args, kwargs))

def run_tests():
    print("==================================================")
    print("Starting Multi-Level (2-Level) Approval System Tests")
    print("==================================================")

    # 1. Seed base data
    # Create users
    u_requester = User(id=1, email="requester@test.com", name="Requester")
    u_l1 = User(id=2, email="l1@test.com", name="L1 Manager")
    u_l2 = User(id=3, email="l2@test.com", name="L2 Manager")
    u_admin = User(id=4, email="admin@test.com", name="Admin", is_superadmin=True)
    db.add_all([u_requester, u_l1, u_l2, u_admin])
    db.commit()

    # Create employees
    emp_l2 = HREmployee(id=2, employee_id="EMP002", user_id=3, name="L2 Manager", email="l2@test.com", is_active=True)
    emp_l1 = HREmployee(id=3, employee_id="EMP003", user_id=2, name="L1 Manager", email="l1@test.com", manager_id=None, manager_l2_id=2, is_active=True)
    emp_req = HREmployee(id=4, employee_id="EMP004", user_id=1, name="Requester Employee", email="requester@test.com", manager_id=3, manager_l2_id=2, is_active=True)
    db.add_all([emp_l2, emp_l1, emp_req])
    db.commit()

    # Create leave type and balance
    leave_type = HRLeaveType(id=1, name="Casual Leave", code="CL", max_days_per_year=12, is_paid=True)
    db.add(leave_type)
    db.commit()

    from datetime import date
    balance = HRLeaveBalance(id=1, employee_id=4, leave_type_id=1, year=2026, allocated_days=12, used_days=0)
    db.add(balance)
    db.commit()

    # Define mock auth handlers
    current_acting_user = [None]
    def mock_is_hr_admin(user, database):
        return user.is_superadmin if user else False
    auth_mock.is_hr_admin = mock_is_hr_admin

    def mock_get_current_employee(user, database):
        if not user:
            return None
        return database.query(HREmployee).filter(HREmployee.user_id == user.id).first()
    auth_mock.get_current_employee = mock_get_current_employee

    # ----------------------------------------------------
    # TEST CASE 1: Normal Flow: L1 Approval -> L2 Approval
    # ----------------------------------------------------
    print("\n--- Test Case 1: L1 Approval followed by L2 Approval ---")
    
    # Create a leave request
    req = HRLeaveRequest(
        id=1,
        reference="LV-001",
        employee_id=4,
        leave_type_id=1,
        from_date=date(2026, 6, 20),
        to_date=date(2026, 6, 22),
        total_days=3,
        status="pending",
        approver_id=3, # L1 Manager
        l1_approver_id=3,
        l2_approver_id=2,
        l1_status="pending",
        l2_status=None
    )
    db.add(req)
    db.commit()

    # Verify initial state
    req = db.query(HRLeaveRequest).filter_by(id=1).first()
    assert req.status == "pending"
    assert req.approver_id == 3
    assert req.l1_status == "pending"
    assert req.l2_status is None
    print("Initial state: verified (status=pending, approver_id=L1, l1_status=pending)")

    # L1 approves
    current_acting_user[0] = u_l1
    bg = MockBackgroundTasks()
    res = approve_leave(
        req_id=1,
        data=LeaveAction(remarks="L1 Approved"),
        background_tasks=bg,
        db=db,
        current_user=u_l1
    )
    db.commit()
    db.refresh(req)

    print(f"L1 Approve response: {res}")
    assert res["message"] == "Approved (L1), pending L2"
    assert req.l1_status == "approved"
    assert req.l1_remarks == "L1 Approved"
    assert req.approver_id == 2 # Shifted to L2 Manager
    assert req.status == "pending" # Still pending overall
    print("L1 approval state: verified (l1_status=approved, approver_id updated to L2, status remains pending)")

    # L2 approves
    current_acting_user[0] = u_l2
    res = approve_leave(
        req_id=1,
        data=LeaveAction(remarks="L2 Approved"),
        background_tasks=bg,
        db=db,
        current_user=u_l2
    )
    db.commit()
    db.refresh(req)

    print(f"L2 Approve response: {res}")
    assert res["message"] == "Approved"
    assert req.l2_status == "approved"
    assert req.l2_remarks == "L2 Approved"
    assert req.status == "approved" # Approved overall
    
    # Verify leave balance deduction
    db.refresh(balance)
    assert balance.used_days == 3
    print("L2 approval state: verified (l2_status=approved, status=approved, leave balance correctly deducted)")

    # ----------------------------------------------------
    # TEST CASE 2: L1 Rejection
    # ----------------------------------------------------
    print("\n--- Test Case 2: L1 Rejection ---")
    req2 = HRLeaveRequest(
        id=2,
        reference="LV-002",
        employee_id=4,
        leave_type_id=1,
        from_date=date(2026, 7, 1),
        to_date=date(2026, 7, 2),
        total_days=2,
        status="pending",
        approver_id=3,
        l1_approver_id=3,
        l2_approver_id=2,
        l1_status="pending",
        l2_status=None
    )
    db.add(req2)
    db.commit()

    # L1 rejects
    current_acting_user[0] = u_l1
    res = reject_leave(
        req_id=2,
        data=LeaveAction(remarks="Not allowed"),
        background_tasks=bg,
        db=db,
        current_user=u_l1
    )
    db.commit()
    db.refresh(req2)

    print(f"L1 Reject response: {res}")
    assert req2.l1_status == "rejected"
    assert req2.status == "rejected"
    print("L1 rejection state: verified (l1_status=rejected, status=rejected)")

    # ----------------------------------------------------
    # TEST CASE 3: L2 Rejection after L1 Approval
    # ----------------------------------------------------
    print("\n--- Test Case 3: L2 Rejection ---")
    req3 = HRLeaveRequest(
        id=3,
        reference="LV-003",
        employee_id=4,
        leave_type_id=1,
        from_date=date(2026, 7, 10),
        to_date=date(2026, 7, 11),
        total_days=2,
        status="pending",
        approver_id=3,
        l1_approver_id=3,
        l2_approver_id=2,
        l1_status="pending",
        l2_status=None
    )
    db.add(req3)
    db.commit()

    # L1 approves first
    approve_leave(req_id=3, data=LeaveAction(remarks="L1 OK"), background_tasks=bg, db=db, current_user=u_l1)
    db.commit()
    db.refresh(req3)
    assert req3.status == "pending"
    assert req3.approver_id == 2

    # L2 rejects
    res = reject_leave(
        req_id=3,
        data=LeaveAction(remarks="L2 reject"),
        background_tasks=bg,
        db=db,
        current_user=u_l2
    )
    db.commit()
    db.refresh(req3)

    print(f"L2 Reject response: {res}")
    assert req3.l2_status == "rejected"
    assert req3.status == "rejected"
    print("L2 rejection state: verified (l2_status=rejected, status=rejected)")

    # ----------------------------------------------------
    # TEST CASE 4: On-Duty Approval Flow
    # ----------------------------------------------------
    print("\n--- Test Case 4: On-Duty Request L1 then L2 Approval ---")
    
    # Create On-Duty Request
    od = HROnDutyRequest(
        id=1,
        reference="OD-001",
        employee_id=4,
        date=date(2026, 6, 25),
        from_time="09:00",
        to_time="18:00",
        status="pending",
        approver_id=3,
        l1_approver_id=3,
        l2_approver_id=2,
        l1_status="pending",
        l2_status=None
    )
    db.add(od)
    db.commit()

    # L1 approves On-Duty
    res = approve_onduty(
        req_id=1,
        data=OnDutyAction(remarks="OD L1 approved"),
        background_tasks=bg,
        db=db,
        current_user=u_l1
    )
    db.commit()
    db.refresh(od)

    print(f"OD L1 Approve response: {res}")
    assert res["message"] == "Approved (L1), pending L2"
    assert od.l1_status == "approved"
    assert od.approver_id == 2
    assert od.status == "pending"
    print("OD L1 approval state: verified (l1_status=approved, approver_id updated to L2, status remains pending)")

    # L2 approves On-Duty
    res = approve_onduty(
        req_id=1,
        data=OnDutyAction(remarks="OD L2 approved"),
        background_tasks=bg,
        db=db,
        current_user=u_l2
    )
    db.commit()
    db.refresh(od)

    print(f"OD L2 Approve response: {res}")
    assert res["message"] == "Approved"
    assert od.l2_status == "approved"
    assert od.status == "approved"
    print("OD L2 approval state: verified (l2_status=approved, status=approved)")

    # ----------------------------------------------------
    # TEST CASE 5: On-Duty L2 Rejection
    # ----------------------------------------------------
    print("\n--- Test Case 5: On-Duty Request L2 Rejection ---")
    od2 = HROnDutyRequest(
        id=2,
        reference="OD-002",
        employee_id=4,
        date=date(2026, 6, 26),
        from_time="09:00",
        to_time="18:00",
        status="pending",
        approver_id=3,
        l1_approver_id=3,
        l2_approver_id=2,
        l1_status="pending",
        l2_status=None
    )
    db.add(od2)
    db.commit()

    # L1 approves
    approve_onduty(req_id=2, data=OnDutyAction(remarks="L1 ok"), background_tasks=bg, db=db, current_user=u_l1)
    db.commit()
    
    # L2 rejects
    res = reject_onduty(
        req_id=2,
        data=OnDutyAction(remarks="OD L2 reject"),
        background_tasks=bg,
        db=db,
        current_user=u_l2
    )
    db.commit()
    db.refresh(od2)

    print(f"OD L2 Reject response: {res}")
    assert od2.l2_status == "rejected"
    assert od2.status == "rejected"
    print("OD L2 rejection state: verified (l2_status=rejected, status=rejected)")

    print("\n==================================================")
    print("All Multi-Level (2-Level) Approval System Tests PASSED!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
