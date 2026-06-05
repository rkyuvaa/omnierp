from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Numeric, Text, Date
from sqlalchemy.orm import relationship
from .database import Base
from datetime import datetime

# ─────────────────────────────────────────────
# BANK DASHBOARD
# ─────────────────────────────────────────────

class BankAccount(Base):
    """Represents a bank account tracked in the system."""
    __tablename__ = "bank_accounts"
    id = Column(Integer, primary_key=True, index=True)
    account_name = Column(String(200), index=True)
    account_number = Column(String(100), nullable=True)
    bank_name = Column(String(200), nullable=True)
    branch_name = Column(String(200), nullable=True)
    ifsc_code = Column(String(20), nullable=True)
    current_balance = Column(Numeric(20, 2), default=0)
    lien_amount = Column(Numeric(20, 2), default=0)       # amount blocked / held
    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    created_by_user = relationship("User", foreign_keys=[created_by])
    transactions = relationship("BankTransaction", back_populates="account", cascade="all, delete-orphan")


class BankTransaction(Base):
    """Represents a payment entry going through the 3-stage approval workflow."""
    __tablename__ = "bank_transactions"
    id = Column(Integer, primary_key=True, index=True)
    reference = Column(String(50), unique=True, index=True)  # PAY-0001
    account_id = Column(Integer, ForeignKey("bank_accounts.id"), index=True)

    transaction_date = Column(Date, nullable=True)         # date of payment
    payee_name = Column(String(300), nullable=True)        # who is being paid
    description = Column(Text, nullable=True)
    amount = Column(Numeric(20, 2), default=0)

    # Status: entered -> verified -> approved
    status = Column(String(20), default="entered", index=True)  # entered | verified | approved | rejected

    # Stage 1 – Employee Entry
    entered_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    entered_at = Column(DateTime, nullable=True)
    entered_by_name = Column(String(100), nullable=True)

    # Stage 2 – Manager Verification
    verified_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    verified_by_name = Column(String(100), nullable=True)
    verification_remarks = Column(Text, nullable=True)

    # Stage 3 – MD Authorization
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    approved_by_name = Column(String(100), nullable=True)
    approval_remarks = Column(Text, nullable=True)

    rejection_remarks = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    account = relationship("BankAccount", back_populates="transactions")
    entered_user = relationship("User", foreign_keys=[entered_by])
    verified_user = relationship("User", foreign_keys=[verified_by])
    approved_user = relationship("User", foreign_keys=[approved_by])
