from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Numeric, Text, Date, UniqueConstraint
from sqlalchemy.orm import relationship
from .database import Base
from datetime import datetime

# ─────────────────────────────────────────────
# ACCOUNT HEAD MASTER
# ─────────────────────────────────────────────

class AccountHead(Base):
    """Account head categories for expense classification."""
    __tablename__ = "account_heads"
    id = Column(Integer, primary_key=True, index=True)
    head_code = Column(String(50), unique=True, index=True)
    head_name = Column(String(200))
    category = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    budgets = relationship("BudgetMaster", back_populates="account_head", cascade="all, delete-orphan")
    mapping_rules = relationship("MappingRule", back_populates="account_head")


# ─────────────────────────────────────────────
# BUDGET MASTER
# ─────────────────────────────────────────────

class BudgetMaster(Base):
    """Monthly budget per account head per financial year."""
    __tablename__ = "budget_master"
    __table_args__ = (
        UniqueConstraint("financial_year", "month", "account_head_id", name="uq_budget_fy_month_head"),
    )
    id = Column(Integer, primary_key=True, index=True)
    financial_year = Column(String(10), index=True)   # e.g. "2025-26"
    month = Column(Integer, index=True)               # 1–12
    account_head_id = Column(Integer, ForeignKey("account_heads.id"), index=True)
    planned_amount = Column(Numeric(20, 2), default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    account_head = relationship("AccountHead", back_populates="budgets")


# ─────────────────────────────────────────────
# MAPPING RULES (description → account head)
# ─────────────────────────────────────────────

class MappingRule(Base):
    """Auto-map imported transaction descriptions to account heads."""
    __tablename__ = "mapping_rules"
    id = Column(Integer, primary_key=True, index=True)
    keyword = Column(String(300))                                               # description ILIKE %keyword%
    account_head_id = Column(Integer, ForeignKey("account_heads.id"))
    bank_account_id = Column(Integer, ForeignKey("bank_accounts.id"), nullable=True)  # None = all banks
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    account_head = relationship("AccountHead", back_populates="mapping_rules")
    bank_account = relationship("BankAccount", foreign_keys=[bank_account_id])


# ─────────────────────────────────────────────
# BANK COLUMN MAPPING (per-bank CSV/Excel config)
# ─────────────────────────────────────────────

class BankColumnMapping(Base):
    """Admin-configured column mapping for parsing each bank's statement file."""
    __tablename__ = "bank_column_mappings"
    id = Column(Integer, primary_key=True, index=True)
    bank_account_id = Column(Integer, ForeignKey("bank_accounts.id"), unique=True)
    date_col = Column(String(100), default="Date")
    description_col = Column(String(100), default="Description")
    debit_col = Column(String(100), default="Debit")
    credit_col = Column(String(100), default="Credit")
    balance_col = Column(String(100), default="Balance")
    date_format = Column(String(50), default="%d/%m/%Y")
    skip_rows = Column(Integer, default=0)  # number of header rows to skip before column row
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    bank_account = relationship("BankAccount", back_populates="column_mapping")


# ─────────────────────────────────────────────
# IMPORT BATCH
# ─────────────────────────────────────────────

class ImportBatch(Base):
    """Tracks each bank-statement upload session."""
    __tablename__ = "import_batches"
    id = Column(Integer, primary_key=True, index=True)
    bank_account_id = Column(Integer, ForeignKey("bank_accounts.id"))
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    filename = Column(String(300), nullable=True)
    row_count = Column(Integer, default=0)
    debit_count = Column(Integer, default=0)
    credit_count = Column(Integer, default=0)
    duplicate_skipped = Column(Integer, default=0)
    status = Column(String(20), default="posted")   # posted | cancelled

    bank_account = relationship("BankAccount", back_populates="import_batches")
    transactions = relationship("BankTransaction", back_populates="import_batch")
    uploaded_by_user = relationship("User", foreign_keys=[uploaded_by])


# ─────────────────────────────────────────────
# BANK ACCOUNT
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
    opening_balance = Column(Numeric(20, 2), default=0)
    current_balance = Column(Numeric(20, 2), default=0)
    lien_amount = Column(Numeric(20, 2), default=0)
    last_statement_balance = Column(Numeric(20, 2), nullable=True)   # balance from last imported row
    last_import_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    created_by_user = relationship("User", foreign_keys=[created_by])
    transactions = relationship("BankTransaction", back_populates="account", cascade="all, delete-orphan")
    column_mapping = relationship("BankColumnMapping", back_populates="bank_account", uselist=False, cascade="all, delete-orphan")
    import_batches = relationship("ImportBatch", back_populates="bank_account")


# ─────────────────────────────────────────────
# BANK TRANSACTION
# ─────────────────────────────────────────────

class BankTransaction(Base):
    """Represents a payment/receipt going through the 3-stage approval workflow."""
    __tablename__ = "bank_transactions"
    id = Column(Integer, primary_key=True, index=True)
    reference = Column(String(50), unique=True, index=True)   # PAY-0001
    account_id = Column(Integer, ForeignKey("bank_accounts.id"), index=True)

    transaction_date = Column(Date, nullable=True)
    payee_name = Column(String(300), nullable=True)
    description = Column(Text, nullable=True)

    # Legacy single-amount field (kept for backward compat with manually entered payments)
    amount = Column(Numeric(20, 2), default=0)
    # Import-derived split amounts
    debit_amount = Column(Numeric(20, 2), default=0)
    credit_amount = Column(Numeric(20, 2), default=0)
    transaction_type = Column(String(10), default="DEBIT", index=True)   # DEBIT | CREDIT

    # Classification
    account_head_id = Column(Integer, ForeignKey("account_heads.id"), nullable=True)
    import_batch_id = Column(Integer, ForeignKey("import_batches.id"), nullable=True)

    # Week (Sunday-start)
    week_number = Column(Integer, nullable=True)    # strftime('%U') value
    week_year = Column(Integer, nullable=True)

    # Status: entered → verified → approved | rejected
    status = Column(String(20), default="entered", index=True)

    # Stage 1 – Entry
    entered_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    entered_at = Column(DateTime, nullable=True)
    entered_by_name = Column(String(100), nullable=True)

    # Stage 2 – Verification
    verified_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    verified_by_name = Column(String(100), nullable=True)
    verification_remarks = Column(Text, nullable=True)

    # Stage 3 – Approval
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    approved_by_name = Column(String(100), nullable=True)
    approval_remarks = Column(Text, nullable=True)

    rejection_remarks = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    account = relationship("BankAccount", back_populates="transactions")
    account_head = relationship("AccountHead", foreign_keys=[account_head_id])
    import_batch = relationship("ImportBatch", back_populates="transactions")
    entered_user = relationship("User", foreign_keys=[entered_by])
    verified_user = relationship("User", foreign_keys=[verified_by])
    approved_user = relationship("User", foreign_keys=[approved_by])
