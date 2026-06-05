from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date as SADate
from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel
from app.database import get_db
from app.models import User
from app.auth import get_current_user
from app.bank_models import BankAccount, BankTransaction

router = APIRouter()

# ── Auth helpers ──────────────────────────────────────────────────────────────
def require_login(current_user: User = Depends(get_current_user)) -> User:
    if not current_user:
        raise HTTPException(401, "Not authenticated")
    return current_user

def require_superadmin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user or not current_user.is_superadmin:
        raise HTTPException(403, "Admin access required")
    return current_user

# ── Reference generator ───────────────────────────────────────────────────────
def _next_ref(db: Session) -> str:
    count = db.query(func.count(BankTransaction.id)).scalar() or 0
    return f"PAY-{count + 1:04d}"

# ── Schemas ───────────────────────────────────────────────────────────────────
class AccountCreate(BaseModel):
    account_name: str
    account_number: Optional[str] = None
    bank_name: Optional[str] = None
    branch_name: Optional[str] = None
    ifsc_code: Optional[str] = None
    current_balance: Optional[float] = 0
    lien_amount: Optional[float] = 0
    notes: Optional[str] = None

class AccountUpdate(BaseModel):
    account_name: Optional[str] = None
    account_number: Optional[str] = None
    bank_name: Optional[str] = None
    branch_name: Optional[str] = None
    ifsc_code: Optional[str] = None
    current_balance: Optional[float] = None
    lien_amount: Optional[float] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

class TransactionCreate(BaseModel):
    account_id: int
    transaction_date: Optional[date] = None
    payee_name: Optional[str] = None
    description: Optional[str] = None
    amount: float

class TransactionVerify(BaseModel):
    remarks: Optional[str] = None

class TransactionApprove(BaseModel):
    remarks: Optional[str] = None

class TransactionReject(BaseModel):
    remarks: Optional[str] = None

# ── Account Endpoints ─────────────────────────────────────────────────────────

@router.get("/accounts")
def list_accounts(db: Session = Depends(get_db), current_user: User = Depends(require_login)):
    accounts = db.query(BankAccount).filter(BankAccount.is_active == True).all()
    return [_serialize_account(a) for a in accounts]

@router.post("/accounts")
def create_account(data: AccountCreate, db: Session = Depends(get_db), current_user: User = Depends(require_superadmin)):
    acc = BankAccount(
        account_name=data.account_name,
        account_number=data.account_number,
        bank_name=data.bank_name,
        branch_name=data.branch_name,
        ifsc_code=data.ifsc_code,
        current_balance=data.current_balance or 0,
        lien_amount=data.lien_amount or 0,
        notes=data.notes,
        created_by=current_user.id
    )
    db.add(acc)
    db.commit()
    db.refresh(acc)
    return _serialize_account(acc)

@router.put("/accounts/{acc_id}")
def update_account(acc_id: int, data: AccountUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_superadmin)):
    acc = db.query(BankAccount).filter(BankAccount.id == acc_id).first()
    if not acc:
        raise HTTPException(404, "Account not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(acc, k, v)
    acc.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(acc)
    return _serialize_account(acc)

@router.delete("/accounts/{acc_id}")
def delete_account(acc_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_superadmin)):
    acc = db.query(BankAccount).filter(BankAccount.id == acc_id).first()
    if not acc:
        raise HTTPException(404, "Account not found")
    acc.is_active = False
    db.commit()
    return {"message": "Account deactivated"}

def _serialize_account(a: BankAccount) -> dict:
    return {
        "id": a.id,
        "account_name": a.account_name,
        "account_number": a.account_number,
        "bank_name": a.bank_name,
        "branch_name": a.branch_name,
        "ifsc_code": a.ifsc_code,
        "current_balance": float(a.current_balance or 0),
        "lien_amount": float(a.lien_amount or 0),
        "balance_with_lien": round(float(a.current_balance or 0) - float(a.lien_amount or 0), 2),
        "notes": a.notes,
        "is_active": a.is_active,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }

# ── Transaction Endpoints ─────────────────────────────────────────────────────

@router.get("/transactions")
def list_transactions(
    account_id: Optional[int] = None,
    status: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_login)
):
    q = db.query(BankTransaction)
    if account_id:
        q = q.filter(BankTransaction.account_id == account_id)
    if status:
        q = q.filter(BankTransaction.status == status)
    if date_from:
        q = q.filter(BankTransaction.transaction_date >= date_from)
    if date_to:
        q = q.filter(BankTransaction.transaction_date <= date_to)
    txns = q.order_by(BankTransaction.created_at.desc()).all()
    return [_serialize_txn(t) for t in txns]

@router.post("/transactions")
def create_transaction(data: TransactionCreate, db: Session = Depends(get_db), current_user: User = Depends(require_login)):
    acc = db.query(BankAccount).filter(BankAccount.id == data.account_id, BankAccount.is_active == True).first()
    if not acc:
        raise HTTPException(404, "Bank account not found")
    txn = BankTransaction(
        reference=_next_ref(db),
        account_id=data.account_id,
        transaction_date=data.transaction_date or date.today(),
        payee_name=data.payee_name,
        description=data.description,
        amount=data.amount,
        status="entered",
        entered_by=current_user.id,
        entered_at=datetime.utcnow(),
        entered_by_name=current_user.name
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return _serialize_txn(txn)

@router.post("/transactions/{txn_id}/verify")
def verify_transaction(txn_id: int, data: TransactionVerify, db: Session = Depends(get_db), current_user: User = Depends(require_login)):
    txn = db.query(BankTransaction).filter(BankTransaction.id == txn_id).first()
    if not txn:
        raise HTTPException(404, "Transaction not found")
    if txn.status != "entered":
        raise HTTPException(400, f"Transaction is already {txn.status}, cannot verify")
    txn.status = "verified"
    txn.verified_by = current_user.id
    txn.verified_at = datetime.utcnow()
    txn.verified_by_name = current_user.name
    txn.verification_remarks = data.remarks
    txn.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(txn)
    return _serialize_txn(txn)

@router.post("/transactions/{txn_id}/approve")
def approve_transaction(txn_id: int, data: TransactionApprove, db: Session = Depends(get_db), current_user: User = Depends(require_login)):
    txn = db.query(BankTransaction).filter(BankTransaction.id == txn_id).first()
    if not txn:
        raise HTTPException(404, "Transaction not found")
    if txn.status != "verified":
        raise HTTPException(400, "Transaction must be verified before approval")
    txn.status = "approved"
    txn.approved_by = current_user.id
    txn.approved_at = datetime.utcnow()
    txn.approved_by_name = current_user.name
    txn.approval_remarks = data.remarks
    txn.updated_at = datetime.utcnow()

    # Deduct from balance on approval
    acc = db.query(BankAccount).filter(BankAccount.id == txn.account_id).first()
    if acc:
        acc.current_balance = float(acc.current_balance or 0) - float(txn.amount or 0)
        acc.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(txn)
    return _serialize_txn(txn)

@router.post("/transactions/{txn_id}/reject")
def reject_transaction(txn_id: int, data: TransactionReject, db: Session = Depends(get_db), current_user: User = Depends(require_login)):
    txn = db.query(BankTransaction).filter(BankTransaction.id == txn_id).first()
    if not txn:
        raise HTTPException(404, "Transaction not found")
    if txn.status in ("approved", "rejected"):
        raise HTTPException(400, f"Transaction already {txn.status}")
    txn.status = "rejected"
    txn.rejection_remarks = data.remarks
    txn.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(txn)
    return _serialize_txn(txn)

@router.delete("/transactions/{txn_id}")
def delete_transaction(txn_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_superadmin)):
    txn = db.query(BankTransaction).filter(BankTransaction.id == txn_id).first()
    if not txn:
        raise HTTPException(404, "Transaction not found")
    if txn.status == "approved":
        raise HTTPException(400, "Cannot delete an approved transaction. Please contact admin.")
    db.delete(txn)
    db.commit()
    return {"message": "Transaction deleted"}

# ── Dashboard Summary Endpoint ────────────────────────────────────────────────

@router.get("/dashboard")
def bank_dashboard(
    account_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_login)
):
    """Returns aggregate summary for the Bank Dashboard."""
    acc_q = db.query(BankAccount).filter(BankAccount.is_active == True)
    if account_id:
        acc_q = acc_q.filter(BankAccount.id == account_id)
    accounts = acc_q.all()

    total_balance = sum(float(a.current_balance or 0) for a in accounts)
    total_lien = sum(float(a.lien_amount or 0) for a in accounts)
    balance_with_lien = round(total_balance - total_lien, 2)

    # Overall status counts
    txn_q = db.query(BankTransaction)
    if account_id:
        txn_q = txn_q.filter(BankTransaction.account_id == account_id)
    all_txns = txn_q.all()

    counts = {
        "entered": sum(1 for t in all_txns if t.status == "entered"),
        "verified": sum(1 for t in all_txns if t.status == "verified"),
        "approved": sum(1 for t in all_txns if t.status == "approved"),
        "rejected": sum(1 for t in all_txns if t.status == "rejected"),
    }

    # Daily breakdown - last 14 days
    from datetime import timedelta
    today = date.today()
    daily = []
    for i in range(13, -1, -1):
        d = today - timedelta(days=i)
        day_txns = [t for t in all_txns if t.transaction_date == d]
        daily.append({
            "date": d.isoformat(),
            "entered": sum(1 for t in day_txns if t.status == "entered"),
            "verified": sum(1 for t in day_txns if t.status == "verified"),
            "approved": sum(1 for t in day_txns if t.status == "approved"),
            "rejected": sum(1 for t in day_txns if t.status == "rejected"),
            "total_amount": sum(float(t.amount or 0) for t in day_txns if t.status == "approved"),
        })

    return {
        "total_balance": round(total_balance, 2),
        "total_lien": round(total_lien, 2),
        "balance_with_lien": balance_with_lien,
        "accounts": [_serialize_account(a) for a in accounts],
        "counts": counts,
        "daily": daily,
    }

def _serialize_txn(t: BankTransaction) -> dict:
    return {
        "id": t.id,
        "reference": t.reference,
        "account_id": t.account_id,
        "transaction_date": t.transaction_date.isoformat() if t.transaction_date else None,
        "payee_name": t.payee_name,
        "description": t.description,
        "amount": float(t.amount or 0),
        "status": t.status,
        "entered_by": t.entered_by,
        "entered_by_name": t.entered_by_name,
        "entered_at": t.entered_at.isoformat() if t.entered_at else None,
        "verified_by": t.verified_by,
        "verified_by_name": t.verified_by_name,
        "verified_at": t.verified_at.isoformat() if t.verified_at else None,
        "verification_remarks": t.verification_remarks,
        "approved_by": t.approved_by,
        "approved_by_name": t.approved_by_name,
        "approved_at": t.approved_at.isoformat() if t.approved_at else None,
        "approval_remarks": t.approval_remarks,
        "rejection_remarks": t.rejection_remarks,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }
