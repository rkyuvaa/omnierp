from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float, Text, Date
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
