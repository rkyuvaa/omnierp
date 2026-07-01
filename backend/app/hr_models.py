from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, JSON, Float, Text, Date, Time, Numeric
from sqlalchemy.orm import relationship
from .database import Base
from datetime import datetime


# ─────────────────────────────────────────────
# EMPLOYEE MASTER
# ─────────────────────────────────────────────
class HREmployee(Base):
    __tablename__ = "hr_employees"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(20), unique=True, index=True)  # EMP001
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, unique=True)
    name = Column(String(100), index=True)
    email = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    designation = Column(String(100), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)
    manager_id = Column(Integer, nullable=True)           # FK to hr_employees.id (L1 Manager)
    manager_l2_id = Column(Integer, nullable=True)        # FK to hr_employees.id (L2 Manager)
    shift_id = Column(Integer, ForeignKey("hr_shifts.id"), nullable=True)
    date_of_joining = Column(Date, nullable=True)
    date_of_leaving = Column(Date, nullable=True)
    basic_salary = Column(Numeric(12, 2), default=0)
    salary_components = Column(JSON, default=[])          # [{"name":"HRA","type":"earning","is_percentage":True,"value":40}]
    salary_template_id = Column(Integer, ForeignKey("hr_salary_templates.id"), nullable=True)
    biometric_id = Column(String(50), nullable=True)      # ID on the biometric machine
    salary_category = Column(String(50), default="regular")  # "regular" or "fixed"
    enable_mobile_punch = Column(Boolean, default=False)     # allow floating punch button
    uan = Column(String(50), nullable=True)                  # Universal Account Number
    esi_number = Column(String(50), nullable=True)           # Employee State Insurance Number
    photo_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    shift = relationship("HRShift", back_populates="employees")
    department = relationship("Department")
    branch = relationship("Branch")
    user = relationship("User")


# ─────────────────────────────────────────────
# SHIFTS
# ─────────────────────────────────────────────
class HRShift(Base):
    __tablename__ = "hr_shifts"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)
    start_time = Column(String(5))    # "09:00"
    end_time = Column(String(5))      # "18:00"
    grace_minutes = Column(Integer, default=15)
    half_day_hours = Column(Float, default=4.0)
    half_day_late_minutes = Column(Integer, default=120)  # e.g. 2 hours late = half day
    half_day_early_minutes = Column(Integer, default=120) # e.g. 2 hours early = half day
    working_days = Column(JSON, default=["Mon","Tue","Wed","Thu","Fri","Sat"])
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    employees = relationship("HREmployee", back_populates="shift")
    branch = relationship("Branch")


# ─────────────────────────────────────────────
# HOLIDAYS
# ─────────────────────────────────────────────
class HRHoliday(Base):
    __tablename__ = "hr_holidays"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    date = Column(Date, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)  # None = all branches
    holiday_type = Column(String(20), default="national")  # national / company
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    branch = relationship("Branch")


# ─────────────────────────────────────────────
# LEAVE TYPES
# ─────────────────────────────────────────────
class HRLeaveType(Base):
    __tablename__ = "hr_leave_types"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    code = Column(String(10), unique=True)   # CL, SL, EL, LOP
    max_days_per_year = Column(Float, default=12)
    is_paid = Column(Boolean, default=True)
    carry_forward = Column(Boolean, default=False)
    carry_forward_max = Column(Float, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    balances = relationship("HRLeaveBalance", back_populates="leave_type")
    requests = relationship("HRLeaveRequest", back_populates="leave_type")


# ─────────────────────────────────────────────
# LEAVE BALANCES (per employee per year)
# ─────────────────────────────────────────────
class HRLeaveBalance(Base):
    __tablename__ = "hr_leave_balances"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("hr_employees.id"))
    leave_type_id = Column(Integer, ForeignKey("hr_leave_types.id"))
    year = Column(Integer)
    allocated_days = Column(Float, default=0)
    used_days = Column(Float, default=0)
    carry_forwarded = Column(Float, default=0)
    monthly_limit = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    employee = relationship("HREmployee")
    leave_type = relationship("HRLeaveType", back_populates="balances")


# ─────────────────────────────────────────────
# LOP WATERFALL RULES (admin-defined priority)
# ─────────────────────────────────────────────
class HRLopWaterfallRule(Base):
    """Ordered rules that define which leave types to consume before marking LOP.
    priority=1 is tried first. If that leave type has no balance, priority=2 is tried, etc.
    """
    __tablename__ = "hr_lop_waterfall_rules"
    id = Column(Integer, primary_key=True, index=True)
    leave_type_id = Column(Integer, ForeignKey("hr_leave_types.id"))
    priority = Column(Integer, default=1)               # 1 = first to try
    respect_monthly_limit = Column(Boolean, default=True)  # Skip if monthly limit hit
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    leave_type = relationship("HRLeaveType")


# ─────────────────────────────────────────────
# LEAVE REQUESTS
# ─────────────────────────────────────────────
class HRLeaveRequest(Base):
    __tablename__ = "hr_leave_requests"
    id = Column(Integer, primary_key=True, index=True)
    reference = Column(String(30), unique=True)
    employee_id = Column(Integer, ForeignKey("hr_employees.id"))
    leave_type_id = Column(Integer, ForeignKey("hr_leave_types.id"))
    from_date = Column(Date)
    to_date = Column(Date)
    total_days = Column(Float, default=1)
    is_half_day = Column(Boolean, default=False)
    half_day_session = Column(String(10), nullable=True)   # morning / afternoon
    reason = Column(Text, nullable=True)
    status = Column(String(20), default="pending")         # pending/approved/rejected/cancelled/auto_approved
    
    # Legacy / Final Approver tracking
    approver_id = Column(Integer, ForeignKey("hr_employees.id"), nullable=True)
    approver_remarks = Column(Text, nullable=True)
    approved_at = Column(DateTime, nullable=True)

    # Multi-level Approvals
    l1_approver_id = Column(Integer, ForeignKey("hr_employees.id"), nullable=True)
    l1_status = Column(String(20), default="pending")      # pending/approved/rejected
    l1_remarks = Column(Text, nullable=True)
    l1_approved_at = Column(DateTime, nullable=True)

    l2_approver_id = Column(Integer, ForeignKey("hr_employees.id"), nullable=True)
    l2_status = Column(String(20), nullable=True)          # pending/approved/rejected/not_required
    l2_remarks = Column(Text, nullable=True)
    l2_approved_at = Column(DateTime, nullable=True)

    auto_approve_at = Column(DateTime, nullable=True)      # created_at + 6 hours
    is_auto_approved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    employee = relationship("HREmployee", foreign_keys=[employee_id])
    approver = relationship("HREmployee", foreign_keys=[approver_id])
    leave_type = relationship("HRLeaveType", back_populates="requests")


# ─────────────────────────────────────────────
# ON-DUTY REQUESTS
# ─────────────────────────────────────────────
class HROnDutyRequest(Base):
    __tablename__ = "hr_onduty_requests"
    id = Column(Integer, primary_key=True, index=True)
    reference = Column(String(30), unique=True)
    employee_id = Column(Integer, ForeignKey("hr_employees.id"))
    date = Column(Date)
    from_time = Column(String(5))   # "09:00"
    to_time = Column(String(5))     # "18:00"
    work_location = Column(String(200), nullable=True)
    purpose = Column(Text, nullable=True)
    status = Column(String(20), default="pending")  # pending/approved/rejected/auto_approved
    
    # Legacy / Final Approver tracking
    approver_id = Column(Integer, ForeignKey("hr_employees.id"), nullable=True)
    approver_remarks = Column(Text, nullable=True)
    approved_at = Column(DateTime, nullable=True)

    # Multi-level Approvals
    l1_approver_id = Column(Integer, ForeignKey("hr_employees.id"), nullable=True)
    l1_status = Column(String(20), default="pending")
    l1_remarks = Column(Text, nullable=True)
    l1_approved_at = Column(DateTime, nullable=True)

    l2_approver_id = Column(Integer, ForeignKey("hr_employees.id"), nullable=True)
    l2_status = Column(String(20), nullable=True)
    l2_remarks = Column(Text, nullable=True)
    l2_approved_at = Column(DateTime, nullable=True)

    auto_approve_at = Column(DateTime, nullable=True)
    is_auto_approved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    employee = relationship("HREmployee", foreign_keys=[employee_id])
    approver = relationship("HREmployee", foreign_keys=[approver_id])


# ─────────────────────────────────────────────
# BIOMETRIC MACHINES
# ─────────────────────────────────────────────
class HRBiometricMachine(Base):
    __tablename__ = "hr_biometric_machines"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    ip_address = Column(String(50))
    port = Column(Integer, default=4370)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)
    device_serial = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    last_sync_at = Column(DateTime, nullable=True)
    last_sync_status = Column(String(20), nullable=True)   # success / failed
    last_sync_count = Column(Integer, default=0)
    last_synced_uid = Column(Integer, default=0)           # last downloaded punch UID
    created_at = Column(DateTime, default=datetime.utcnow)

    branch = relationship("Branch")
    punches = relationship("HRAttendancePunch", back_populates="machine")


# ─────────────────────────────────────────────
# RAW PUNCH RECORDS
# ─────────────────────────────────────────────
class HRAttendancePunch(Base):
    __tablename__ = "hr_attendance_punches"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("hr_employees.id"))
    punch_time = Column(DateTime, index=True)
    source = Column(String(20), default="biometric")  # biometric / mobile / manual
    photo_url = Column(String(500), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    location_name = Column(String(300), nullable=True)
    machine_id = Column(Integer, ForeignKey("hr_biometric_machines.id"), nullable=True)
    raw_punch_uid = Column(String(100), nullable=True)  # dedup key from biometric
    created_at = Column(DateTime, default=datetime.utcnow)

    employee = relationship("HREmployee")
    machine = relationship("HRBiometricMachine", back_populates="punches")


# ─────────────────────────────────────────────
# DAILY CONSOLIDATED ATTENDANCE RECORD
# ─────────────────────────────────────────────
class HRAttendanceRecord(Base):
    __tablename__ = "hr_attendance_records"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("hr_employees.id"), index=True)
    date = Column(Date, index=True)
    check_in = Column(DateTime, nullable=True)
    check_out = Column(DateTime, nullable=True)
    hours_worked = Column(Float, nullable=True)
    status = Column(String(20), default="absent")
    # present / late / absent / half_day / leave / on_duty / holiday / weekly_off
    is_late = Column(Boolean, default=False)
    late_minutes = Column(Integer, default=0)
    left_early = Column(Boolean, default=False)
    early_by_minutes = Column(Integer, default=0)
    check_in_photo = Column(String(500), nullable=True)
    check_in_location = Column(String(300), nullable=True)
    leave_request_id = Column(Integer, ForeignKey("hr_leave_requests.id"), nullable=True)
    onduty_request_id = Column(Integer, ForeignKey("hr_onduty_requests.id"), nullable=True)
    correction_reason = Column(Text, nullable=True)
    corrected_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    comp_off_hours = Column(Float, default=0)   # Overtime hours that earned comp-off this day
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    employee = relationship("HREmployee")
    leave_request = relationship("HRLeaveRequest")
    onduty_request = relationship("HROnDutyRequest")


# ─────────────────────────────────────────────
# IN-APP NOTIFICATIONS
# ─────────────────────────────────────────────
class HRNotification(Base):
    __tablename__ = "hr_notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    title = Column(String(200))
    message = Column(Text)
    notif_type = Column(String(50), default="info")   # info / success / warning / action
    reference_type = Column(String(50), nullable=True)  # leave / onduty / attendance
    reference_id = Column(Integer, nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class HRPushSubscription(Base):
    __tablename__ = "hr_push_subscriptions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    endpoint = Column(Text, unique=True, index=True)
    p256dh = Column(String(200))
    auth = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class HRFcmToken(Base):
    """Stores Firebase Cloud Messaging device tokens for native Android push notifications."""
    __tablename__ = "hr_fcm_tokens"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    token = Column(Text, unique=True, index=True)          # FCM device token
    device_label = Column(String(100), nullable=True)      # e.g. "Samsung S24"
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")



# ─────────────────────────────────────────────
# PAYROLL RECORDS (monthly)
# ─────────────────────────────────────────────
class HRPayrollRecord(Base):
    __tablename__ = "hr_payroll_records"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("hr_employees.id"))
    year = Column(Integer)
    month = Column(Integer)
    working_days = Column(Integer, default=0)   # shift working days in month
    present_days = Column(Float, default=0)
    absent_days = Column(Float, default=0)
    leave_days = Column(Float, default=0)
    lop_days = Column(Float, default=0)
    on_duty_days = Column(Float, default=0)
    basic_salary = Column(Numeric(12, 2), default=0)
    total_earnings = Column(Numeric(12, 2), default=0)
    total_deductions = Column(Numeric(12, 2), default=0)
    net_salary = Column(Numeric(12, 2), default=0)
    arrears_held = Column(Numeric(12, 2), default=0)
    arrears_paid = Column(Numeric(12, 2), default=0)
    components_breakdown = Column(JSON, default={})
    status = Column(String(20), default="draft")    # draft / finalized
    finalized_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    employee = relationship("HREmployee")

class HRArrearRecord(Base):
    __tablename__ = "hr_arrear_records"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("hr_employees.id"))
    held_month = Column(Integer)
    held_year = Column(Integer)
    amount_held = Column(Numeric(12, 2), default=0)
    status = Column(String(20), default="held") # held / paid
    paid_in_month = Column(Integer, nullable=True)
    paid_in_year = Column(Integer, nullable=True)
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    employee = relationship("HREmployee")

class HRSalaryTemplate(Base):
    __tablename__ = "hr_salary_templates"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True)
    description = Column(String(500), nullable=True)
    components = Column(JSON) # List of {component_id, override_value}
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class HRSalaryComponent(Base):
    """Master list of salary heads (Basic, HRA, PF, ESI, etc.)"""
    __tablename__ = "hr_salary_components"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))               # e.g. "Basic Salary"
    code = Column(String(20), unique=True)   # e.g. "BASIC", "HRA", "PF_EMP"
    component_type = Column(String(50), default="earning")  # earning | deduction | employer_contribution
    calc_type = Column(String(30), default="percentage_of_ctc")
    # percentage_of_ctc | percentage_of_basic | percentage_of_gross | fixed | slab
    calc_value = Column(Float, default=0)
    cap_amount = Column(Float, nullable=True)  # e.g. 15000 for PF cap rule
    slabs = Column(JSON, nullable=True)  # [{"min":0,"max":10000,"value":0},{"min":10001,"max":null,"value":200}]
    apply_if_gross_below = Column(Float, nullable=True)  # ESI: only if gross ≤ 21000
    apply_if_gross_above = Column(Float, nullable=True)  # TDS: only if gross ≥ 100000
    show_on_payslip = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)  # Controls payslip display order
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class HRConfig(Base):
    __tablename__ = "hr_configs"
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, index=True) # e.g. "working_days"
    value = Column(JSON)                              # e.g. ["Mon","Tue","Wed","Thu","Fri","Sat"]
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
