from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float, Text, Date, JSON
from sqlalchemy.orm import relationship
from .database import Base
from datetime import datetime


# ─────────────────────────────────────────────
# EXPENSE CATEGORIES
# ─────────────────────────────────────────────
class ExpenseCategory(Base):
    """Admin-managed expense categories (Travel, Food, Office Supplies, etc.)"""
    __tablename__ = "expense_categories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    code = Column(String(20), unique=True, index=True)
    description = Column(Text, nullable=True)
    max_limit = Column(Float, nullable=True)           # Max amount per claim (None = unlimited)
    requires_receipt = Column(Boolean, default=True)    # Whether a receipt is mandatory
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    claims = relationship("ExpenseClaim", back_populates="category")


# ─────────────────────────────────────────────
# EXPENSE CLAIMS
# ─────────────────────────────────────────────
class ExpenseClaim(Base):
    """Employee expense reimbursement claim with 2-level approval workflow."""
    __tablename__ = "expense_claims"
    id = Column(Integer, primary_key=True, index=True)
    reference = Column(String(30), unique=True, index=True)   # EXP00001
    employee_id = Column(Integer, ForeignKey("hr_employees.id"))
    category_id = Column(Integer, ForeignKey("expense_categories.id"), nullable=True)

    claim_date = Column(Date)                               # Date of submission
    expense_date = Column(Date)                             # Date expense was incurred
    amount = Column(Float, default=0)
    description = Column(Text, nullable=True)
    purpose = Column(Text, nullable=True)
    receipt_filename = Column(String(300), nullable=True)   # Stored under /uploads/expenses/

    # Overall status
    status = Column(String(20), default="pending")  # pending/approved/rejected/cancelled/reimbursed

    # Legacy / Final approver tracking (current active approver)
    approver_id = Column(Integer, ForeignKey("hr_employees.id"), nullable=True)
    approver_remarks = Column(Text, nullable=True)
    approved_at = Column(DateTime, nullable=True)

    # Multi-level approval (same structure as leave/onduty)
    l1_approver_id = Column(Integer, ForeignKey("hr_employees.id"), nullable=True)
    l1_status = Column(String(20), default="pending")   # pending/approved/rejected
    l1_remarks = Column(Text, nullable=True)
    l1_approved_at = Column(DateTime, nullable=True)

    l2_approver_id = Column(Integer, ForeignKey("hr_employees.id"), nullable=True)
    l2_status = Column(String(20), nullable=True)       # pending/approved/rejected
    l2_remarks = Column(Text, nullable=True)
    l2_approved_at = Column(DateTime, nullable=True)

    # Reimbursement tracking
    reimbursement_mode = Column(String(20), nullable=True)   # direct / payroll
    reimbursed_at = Column(DateTime, nullable=True)
    reimbursement_ref = Column(String(100), nullable=True)   # Reference number for payment

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    employee = relationship("HREmployee", foreign_keys=[employee_id])
    approver = relationship("HREmployee", foreign_keys=[approver_id])
    category = relationship("ExpenseCategory", back_populates="claims")


# ─────────────────────────────────────────────
# EXPENSE ADVANCE REQUESTS
# ─────────────────────────────────────────────
class ExpenseAdvanceRequest(Base):
    """Employee cash advance requests with L1/L2 approval workflow."""
    __tablename__ = "expense_advance_requests"
    id = Column(Integer, primary_key=True, index=True)
    reference = Column(String(50), unique=True, index=True, nullable=True) # ADV-YYYY-000001
    employee_id = Column(Integer, ForeignKey("hr_employees.id"))
    amount = Column(Float, default=0.0)
    purpose = Column(Text, nullable=True)
    project_code = Column(String(100), nullable=True)
    required_date = Column(Date, nullable=True)
    attachment_filename = Column(String(300), nullable=True) # Supporting document

    # Lifecycle status: draft, submitted, under_review, approved, rejected, clarification_pending, settlement_pending, settlement_submitted, settlement_approved, closed
    status = Column(String(30), default="draft")

    # Multi-level approval
    approver_id = Column(Integer, ForeignKey("hr_employees.id"), nullable=True) # Current active approver
    l1_approver_id = Column(Integer, ForeignKey("hr_employees.id"), nullable=True)
    l1_status = Column(String(20), default="pending") # pending/approved/rejected
    l1_remarks = Column(Text, nullable=True)
    l1_approved_at = Column(DateTime, nullable=True)

    l2_approver_id = Column(Integer, ForeignKey("hr_employees.id"), nullable=True)
    l2_status = Column(String(20), nullable=True) # pending/approved/rejected
    l2_remarks = Column(Text, nullable=True)
    l2_approved_at = Column(DateTime, nullable=True)

    clarification_remarks = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    employee = relationship("HREmployee", foreign_keys=[employee_id])
    approver = relationship("HREmployee", foreign_keys=[approver_id])
    l1_approver = relationship("HREmployee", foreign_keys=[l1_approver_id])
    l2_approver = relationship("HREmployee", foreign_keys=[l2_approver_id])
    settlement_lines = relationship("ExpenseAdvanceSettlementLine", back_populates="advance", cascade="all, delete-orphan")


# ─────────────────────────────────────────────
# EXPENSE ADVANCE SETTLEMENT LINES
# ─────────────────────────────────────────────
class ExpenseAdvanceSettlementLine(Base):
    """Detailed itemized expense entries recorded against an approved advance request."""
    __tablename__ = "expense_advance_settlement_lines"
    id = Column(Integer, primary_key=True, index=True)
    advance_id = Column(Integer, ForeignKey("expense_advance_requests.id"))
    date = Column(Date)
    expense_type = Column(String(100))
    cost_code = Column(String(100), nullable=True)
    cost_to = Column(String(100), nullable=True)
    from_location = Column(String(150), nullable=True)
    to_location = Column(String(150), nullable=True)
    description = Column(Text, nullable=True)
    paid_to = Column(String(150), nullable=True)
    gst_rate = Column(Float, default=0.0) # percentage (e.g. 18.0)
    amount = Column(Float, default=0.0)
    bill_attachments = Column(JSON, default=[]) # list of filenames ["receipt_123.png"]

    advance = relationship("ExpenseAdvanceRequest", back_populates="settlement_lines")


# ─────────────────────────────────────────────
# EXPENSE ADVANCE LEDGER
# ─────────────────────────────────────────────
class ExpenseAdvanceLedger(Base):
    """Financial ledger tracking credits, debits and returns per employee."""
    __tablename__ = "expense_advance_ledger"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("hr_employees.id"))
    advance_id = Column(Integer, ForeignKey("expense_advance_requests.id"), nullable=True)
    transaction_type = Column(String(20)) # credit / debit / return
    amount = Column(Float, default=0.0)
    running_balance = Column(Float, default=0.0)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    employee = relationship("HREmployee", foreign_keys=[employee_id])
    advance = relationship("ExpenseAdvanceRequest", foreign_keys=[advance_id])
