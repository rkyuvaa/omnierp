"""
Expenses & Reimbursement Router — /api/expenses
Full-featured expense management: categories, claim submission,
2-level approval workflow (same hierarchy as Leave/OnDuty), and reimbursement tracking.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel
import os, uuid, shutil

from app.database import get_db
from app.models import User
from app.auth import get_current_user, is_hr_admin
from app.expense_models import ExpenseCategory, ExpenseClaim, ExpenseAdvanceRequest, ExpenseAdvanceSettlementLine, ExpenseAdvanceLedger
from app.hr_models import HREmployee, HRNotification

router = APIRouter()

# ── Upload directory ──────────────────────────────────────────────────────────
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.normpath(os.path.join(_BASE_DIR, "../../static/uploads/expenses"))
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ── Notification helper ───────────────────────────────────────────────────────
def _notify(db: Session, user_id: int, title: str, message: str, ref_id: int = None):
    notif = HRNotification(user_id=user_id, title=title, message=message,
                           reference_type="expense", reference_id=ref_id)
    db.add(notif)
    try:
        from app.utils.push_service import send_push_to_user
        send_push_to_user(user_id, title, message, "expense", ref_id, db)
    except Exception as e:
        print(f"Failed to send push: {e}")

# ── Reference generator ───────────────────────────────────────────────────────
def _next_ref(db: Session) -> str:
    count = db.query(func.count(ExpenseClaim.id)).scalar() or 0
    return f"EXP{str(count + 1).zfill(5)}"

# ── Pydantic Schemas ──────────────────────────────────────────────────────────
class CategoryCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    max_limit: Optional[float] = None
    requires_receipt: bool = True

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    max_limit: Optional[float] = None
    requires_receipt: Optional[bool] = None
    is_active: Optional[bool] = None

class ClaimSubmit(BaseModel):
    category_id: Optional[int] = None
    expense_date: date
    amount: float
    description: Optional[str] = None
    purpose: Optional[str] = None
    receipt_filename: Optional[str] = None

class ExpenseAction(BaseModel):
    remarks: Optional[str] = None

class ReimburseAction(BaseModel):
    reimbursement_mode: str = "direct"   # direct / payroll
    reimbursement_ref: Optional[str] = None

# ── Serializers ───────────────────────────────────────────────────────────────
def _ser_cat(c: ExpenseCategory) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "code": c.code,
        "description": c.description,
        "max_limit": c.max_limit,
        "requires_receipt": c.requires_receipt,
        "is_active": c.is_active,
        "created_at": str(c.created_at) if c.created_at else None,
    }

def _ser_claim(c: ExpenseClaim) -> dict:
    return {
        "id": c.id,
        "reference": c.reference,
        "employee_id": c.employee_id,
        "employee_name": c.employee.name if c.employee else None,
        "employee_code": c.employee.employee_id if c.employee else None,
        "category_id": c.category_id,
        "category_name": c.category.name if c.category else None,
        "claim_date": str(c.claim_date) if c.claim_date else None,
        "expense_date": str(c.expense_date) if c.expense_date else None,
        "amount": float(c.amount or 0),
        "description": c.description,
        "purpose": c.purpose,
        "receipt_filename": c.receipt_filename,
        "status": c.status,
        "approver_id": c.approver_id,
        "approver_name": c.approver.name if c.approver else None,
        "approver_remarks": c.approver_remarks,
        "approved_at": str(c.approved_at) if c.approved_at else None,
        "l1_approver_id": c.l1_approver_id,
        "l1_status": c.l1_status,
        "l1_remarks": c.l1_remarks,
        "l1_approved_at": str(c.l1_approved_at) if c.l1_approved_at else None,
        "l2_approver_id": c.l2_approver_id,
        "l2_status": c.l2_status,
        "l2_remarks": c.l2_remarks,
        "l2_approved_at": str(c.l2_approved_at) if c.l2_approved_at else None,
        "reimbursement_mode": c.reimbursement_mode,
        "reimbursed_at": str(c.reimbursed_at) if c.reimbursed_at else None,
        "reimbursement_ref": c.reimbursement_ref,
        "created_at": str(c.created_at) if c.created_at else None,
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CATEGORIES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/categories")
def list_categories(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(ExpenseCategory)
    if not include_inactive:
        q = q.filter(ExpenseCategory.is_active == True)
    return [_ser_cat(c) for c in q.order_by(ExpenseCategory.name).all()]


@router.post("/categories")
def create_category(
    data: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not is_hr_admin(current_user, db):
        raise HTTPException(403, "Admin access required")
    if db.query(ExpenseCategory).filter(ExpenseCategory.code == data.code.upper()).first():
        raise HTTPException(400, "Category code already exists")
    payload = data.model_dump()
    payload["code"] = data.code.upper()
    cat = ExpenseCategory(**payload)
    db.add(cat); db.commit(); db.refresh(cat)
    return _ser_cat(cat)


@router.put("/categories/{cat_id}")
def update_category(
    cat_id: int,
    data: CategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not is_hr_admin(current_user, db):
        raise HTTPException(403, "Admin access required")
    cat = db.query(ExpenseCategory).filter(ExpenseCategory.id == cat_id).first()
    if not cat: raise HTTPException(404, "Category not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(cat, k, v)
    cat.updated_at = datetime.utcnow()
    db.commit(); db.refresh(cat)
    return _ser_cat(cat)


@router.delete("/categories/{cat_id}")
def delete_category(
    cat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not is_hr_admin(current_user, db):
        raise HTTPException(403, "Admin access required")
    cat = db.query(ExpenseCategory).filter(ExpenseCategory.id == cat_id).first()
    if not cat: raise HTTPException(404, "Category not found")
    cat.is_active = False
    cat.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Deactivated"}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# RECEIPT UPLOAD
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.post("/upload-receipt")
async def upload_receipt(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    allowed_exts = {".jpg", ".jpeg", ".png", ".pdf", ".docx", ".doc", ".xlsx", ".xls", ".txt", ".zip"}
    if ext not in allowed_exts:
        raise HTTPException(400, "Unsupported file format. Allowed formats: PDF, Word, Excel, ZIP, Text, and Images")
    unique_name = f"{uuid.uuid4().hex}{ext or '.jpg'}"
    file_path = os.path.join(UPLOAD_DIR, unique_name)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"filename": unique_name, "original_name": file.filename}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CLAIMS — CRUD
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.post("/")
def submit_claim(
    data: ClaimSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.auth import get_current_employee
    emp = get_current_employee(current_user, db)

    # Validate category
    if data.category_id:
        cat = db.query(ExpenseCategory).filter(
            ExpenseCategory.id == data.category_id,
            ExpenseCategory.is_active == True
        ).first()
        if not cat:
            raise HTTPException(400, "Invalid expense category")
        if cat.max_limit and data.amount > cat.max_limit:
            raise HTTPException(400, f"Amount exceeds maximum limit of \u20b9{cat.max_limit:,.2f} for {cat.name}")
        if cat.requires_receipt and not data.receipt_filename:
            raise HTTPException(400, f"Receipt is required for {cat.name}")

    claim = ExpenseClaim(
        reference=_next_ref(db),
        employee_id=emp.id,
        category_id=data.category_id,
        claim_date=date.today(),
        expense_date=data.expense_date,
        amount=data.amount,
        description=data.description,
        purpose=data.purpose,
        receipt_filename=data.receipt_filename,
        status="pending",
        approver_id=emp.manager_id,
        l1_approver_id=emp.manager_id,
        l2_approver_id=getattr(emp, "manager_l2_id", None),
        l1_status="pending",
    )
    db.add(claim); db.commit(); db.refresh(claim)

    # Notify L1 manager
    if emp.manager_id:
        manager = db.query(HREmployee).filter(HREmployee.id == emp.manager_id).first()
        if manager and manager.user_id:
            _notify(db, manager.user_id,
                    "Expense Claim Submitted",
                    f"{emp.name} submitted an expense claim of \u20b9{data.amount:,.2f} for approval.",
                    claim.id)
    db.commit()
    return _ser_claim(claim)


@router.get("/my")
def list_my_claims(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.auth import get_current_employee_optional
    emp = get_current_employee_optional(current_user, db)
    if not emp:
        return []
    q = db.query(ExpenseClaim).filter(ExpenseClaim.employee_id == emp.id)
    if status:
        q = q.filter(ExpenseClaim.status == status)
    return [_ser_claim(c) for c in q.order_by(ExpenseClaim.created_at.desc()).all()]


@router.get("/pending-approvals")
def list_pending_approvals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List claims pending THIS user's approval."""
    from app.auth import get_current_employee_optional
    is_admin = is_hr_admin(current_user, db)
    emp = get_current_employee_optional(current_user, db)
    q = db.query(ExpenseClaim).filter(ExpenseClaim.status == "pending")
    if not is_admin:
        if not emp:
            return []
        q = q.filter(ExpenseClaim.approver_id == emp.id)
    return [_ser_claim(c) for c in q.order_by(ExpenseClaim.created_at.desc()).all()]


@router.get("/summary")
def get_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.auth import get_current_employee_optional
    is_admin = is_hr_admin(current_user, db)
    emp = get_current_employee_optional(current_user, db)
    q = db.query(ExpenseClaim)
    if not is_admin and emp:
        q = q.filter(ExpenseClaim.employee_id == emp.id)
    all_claims = q.all()
    today = date.today()
    pending_count = sum(1 for c in all_claims if c.status == "pending")
    approved_amount = sum(c.amount or 0 for c in all_claims if c.status in ("approved", "reimbursed"))
    reimbursed_amount = sum(c.amount or 0 for c in all_claims if c.status == "reimbursed")
    total_this_month = sum(
        c.amount or 0 for c in all_claims
        if c.claim_date and c.claim_date.month == today.month and c.claim_date.year == today.year
    )
    pending_my_approval = 0
    if emp:
        pending_my_approval = db.query(func.count(ExpenseClaim.id)).filter(
            ExpenseClaim.status == "pending",
            ExpenseClaim.approver_id == emp.id
        ).scalar() or 0
    return {
        "total_claims": len(all_claims),
        "pending_count": pending_count,
        "approved_amount": approved_amount,
        "reimbursed_amount": reimbursed_amount,
        "total_this_month": total_this_month,
        "pending_my_approval": pending_my_approval,
    }


@router.get("/")
def list_claims(
    status: Optional[str] = None,
    employee_id: Optional[int] = None,
    category_id: Optional[int] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.auth import get_current_employee_optional
    is_admin = is_hr_admin(current_user, db)
    emp = get_current_employee_optional(current_user, db)
    q = db.query(ExpenseClaim)
    if not is_admin:
        if not emp:
            return []
        q = q.filter(
            (ExpenseClaim.employee_id == emp.id) |
            (ExpenseClaim.l1_approver_id == emp.id) |
            (ExpenseClaim.l2_approver_id == emp.id)
        )
    else:
        if employee_id:
            q = q.filter(ExpenseClaim.employee_id == employee_id)
    if status:
        q = q.filter(ExpenseClaim.status == status)
    if category_id:
        q = q.filter(ExpenseClaim.category_id == category_id)
    if from_date:
        q = q.filter(ExpenseClaim.expense_date >= from_date)
    if to_date:
        q = q.filter(ExpenseClaim.expense_date <= to_date)
    return [_ser_claim(c) for c in q.order_by(ExpenseClaim.created_at.desc()).all()]


# ── Expense Configurations & Policies ───────────────────────────────────────
class ExpenseConfigPayload(BaseModel):
    l2_threshold_amount: Optional[float] = 5000.0
    auto_approve_hours: Optional[int] = 24
    max_advance_amount: Optional[float] = 50000.0
    allow_multiple_active_advances: Optional[bool] = False
    policy_notes: Optional[str] = ""

@router.get("/config")
def get_expense_config(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.routers.hr_config import get_hr_config
    return {
        "l2_threshold_amount": get_hr_config(db, "expense_l2_threshold", 5000.0),
        "auto_approve_hours": get_hr_config(db, "expense_auto_approve_hours", 24),
        "max_advance_amount": get_hr_config(db, "expense_max_advance_amount", 50000.0),
        "allow_multiple_active_advances": get_hr_config(db, "expense_allow_multiple_advances", False),
        "policy_notes": get_hr_config(db, "expense_policy_notes", "Receipts are required for all claims above ₹500.")
    }

@router.post("/config")
def update_expense_config(data: ExpenseConfigPayload, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not is_hr_admin(current_user, db):
        raise HTTPException(403, "Admin access required to update configurations")
    from app.routers.hr_config import set_hr_config
    set_hr_config(db, "expense_l2_threshold", data.l2_threshold_amount)
    set_hr_config(db, "expense_auto_approve_hours", data.auto_approve_hours)
    set_hr_config(db, "expense_max_advance_amount", data.max_advance_amount)
    set_hr_config(db, "expense_allow_multiple_advances", data.allow_multiple_active_advances)
    set_hr_config(db, "expense_policy_notes", data.policy_notes)
    return {"message": "Expense configurations updated successfully"}


@router.get("/{claim_id}")
def get_claim(
    claim_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.auth import get_current_employee_optional
    claim = db.query(ExpenseClaim).filter(ExpenseClaim.id == claim_id).first()
    if not claim: raise HTTPException(404, "Claim not found")
    if not is_hr_admin(current_user, db):
        emp = get_current_employee_optional(current_user, db)
        if not emp or (
            claim.employee_id != emp.id and
            claim.l1_approver_id != emp.id and
            claim.l2_approver_id != emp.id
        ):
            raise HTTPException(403, "Access denied")
    return _ser_claim(claim)


@router.post("/{claim_id}/cancel")
def cancel_claim(
    claim_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.auth import get_current_employee
    emp = get_current_employee(current_user, db)
    claim = db.query(ExpenseClaim).filter(ExpenseClaim.id == claim_id).first()
    if not claim: raise HTTPException(404, "Not found")
    if claim.employee_id != emp.id and not is_hr_admin(current_user, db):
        raise HTTPException(403, "Access denied")
    if claim.status != "pending":
        raise HTTPException(400, f"Cannot cancel a claim that is already {claim.status}")
    claim.status = "cancelled"
    claim.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Claim cancelled"}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# APPROVAL WORKFLOW (mirrors hr_leave.py exactly)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.post("/{claim_id}/approve")
def approve_claim(
    claim_id: int,
    data: ExpenseAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    claim = db.query(ExpenseClaim).filter(ExpenseClaim.id == claim_id).first()
    if not claim: raise HTTPException(404, "Claim not found")
    if not is_hr_admin(current_user, db):
        from app.auth import get_current_employee
        emp = get_current_employee(current_user, db)
        if claim.approver_id != emp.id:
            raise HTTPException(403, "Access denied. You are not authorized to approve this claim.")
    if claim.status != "pending":
        raise HTTPException(400, f"Claim is already {claim.status}")

    emp = None
    if not is_hr_admin(current_user, db):
        from app.auth import get_current_employee
        emp = get_current_employee(current_user, db)

    is_l1 = (claim.l1_approver_id == emp.id) if emp else False
    is_l2 = (claim.l2_approver_id == emp.id) if emp else False
    is_super = is_hr_admin(current_user, db)
    final_approval = False

    if is_l1 and not is_l2 and claim.l1_status == "pending":
        claim.l1_status = "approved"
        claim.l1_remarks = data.remarks
        claim.l1_approved_at = datetime.utcnow()
        if claim.l2_approver_id:
            claim.approver_id = claim.l2_approver_id
            l2_manager = db.query(HREmployee).filter(HREmployee.id == claim.l2_approver_id).first()
            if l2_manager and l2_manager.user_id:
                _notify(db, l2_manager.user_id,
                        "Expense Claim Pending (L2)",
                        f"{claim.employee.name if claim.employee else 'Employee'}'s expense claim of \u20b9{claim.amount:,.2f} approved by L1. Pending your approval.",
                        claim.id)
            db.commit()
            return {"message": "Approved (L1), pending L2", "id": claim.id}
        else:
            final_approval = True
    elif is_l2 and (claim.l2_status == "pending" or not claim.l2_status):
        claim.l2_status = "approved"
        claim.l2_remarks = data.remarks
        claim.l2_approved_at = datetime.utcnow()
        final_approval = True
    elif is_super:
        final_approval = True
    else:
        raise HTTPException(400, "You cannot approve this claim in its current state.")

    if final_approval:
        claim.status = "approved"
        claim.approver_remarks = data.remarks
        claim.approved_at = datetime.utcnow()
        if claim.employee and claim.employee.user_id:
            _notify(db, claim.employee.user_id,
                    "Expense Claim Approved \u2713",
                    f"Your expense claim {claim.reference} of \u20b9{claim.amount:,.2f} has been approved.",
                    claim.id)
    db.commit()
    return {"message": "Approved", "id": claim.id}


@router.post("/{claim_id}/reject")
def reject_claim(
    claim_id: int,
    data: ExpenseAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    claim = db.query(ExpenseClaim).filter(ExpenseClaim.id == claim_id).first()
    if not claim: raise HTTPException(404, "Claim not found")
    if not is_hr_admin(current_user, db):
        from app.auth import get_current_employee
        emp = get_current_employee(current_user, db)
        if claim.approver_id != emp.id:
            raise HTTPException(403, "Access denied. You are not authorized to reject this claim.")
    if claim.status != "pending":
        raise HTTPException(400, f"Claim is already {claim.status}")

    emp = None
    if not is_hr_admin(current_user, db):
        from app.auth import get_current_employee
        emp = get_current_employee(current_user, db)

    is_l1 = (claim.l1_approver_id == emp.id) if emp else False
    is_l2 = (claim.l2_approver_id == emp.id) if emp else False

    if is_l1 and claim.l1_status == "pending":
        claim.l1_status = "rejected"
        claim.l1_remarks = data.remarks
        claim.l1_approved_at = datetime.utcnow()
    elif is_l2 and (claim.l2_status == "pending" or not claim.l2_status):
        claim.l2_status = "rejected"
        claim.l2_remarks = data.remarks
        claim.l2_approved_at = datetime.utcnow()

    claim.status = "rejected"
    claim.approver_remarks = data.remarks
    claim.approved_at = datetime.utcnow()
    if claim.employee and claim.employee.user_id:
        _notify(db, claim.employee.user_id,
                "Expense Claim Rejected \u2717",
                f"Your expense claim {claim.reference} of \u20b9{claim.amount:,.2f} was rejected. Reason: {data.remarks or 'No reason given'}",
                claim.id)
    db.commit()
    return {"message": "Rejected"}


@router.post("/{claim_id}/reimburse")
def reimburse_claim(
    claim_id: int,
    data: ReimburseAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not is_hr_admin(current_user, db):
        raise HTTPException(403, "Admin access required")
    claim = db.query(ExpenseClaim).filter(ExpenseClaim.id == claim_id).first()
    if not claim: raise HTTPException(404, "Claim not found")
    if claim.status != "approved":
        raise HTTPException(400, f"Only approved claims can be marked as reimbursed. Current: {claim.status}")
    claim.status = "reimbursed"
    claim.reimbursement_mode = data.reimbursement_mode
    claim.reimbursed_at = datetime.utcnow()
    claim.reimbursement_ref = data.reimbursement_ref
    claim.updated_at = datetime.utcnow()
    if claim.employee and claim.employee.user_id:
        _notify(db, claim.employee.user_id,
                "Expense Reimbursed \U0001f4b0",
                f"Your expense claim {claim.reference} of \u20b9{claim.amount:,.2f} has been reimbursed via {data.reimbursement_mode}.",
                claim.id)
    db.commit()
    return {"message": "Marked as reimbursed", "id": claim.id}


# ── Seed default categories ───────────────────────────────────────────────────
def seed_expense_categories(db: Session):
    """Seed default expense categories if none exist."""
    if db.query(func.count(ExpenseCategory.id)).scalar() > 0:
        return
    defaults = [
        {"name": "Travel", "code": "TRAVEL", "description": "Business travel expenses", "requires_receipt": True},
        {"name": "Food & Meals", "code": "FOOD", "description": "Meals and entertainment", "max_limit": 1000.0, "requires_receipt": True},
        {"name": "Office Supplies", "code": "OFFICE", "description": "Stationery and office materials", "requires_receipt": True},
        {"name": "Accommodation", "code": "HOTEL", "description": "Hotel and lodging expenses", "requires_receipt": True},
        {"name": "Communication", "code": "COMM", "description": "Internet, phone and communication costs", "requires_receipt": False},
        {"name": "Training & Development", "code": "TRAIN", "description": "Courses, books and training materials", "requires_receipt": True},
        {"name": "Miscellaneous", "code": "MISC", "description": "Other business expenses", "requires_receipt": True},
    ]
    for item in defaults:
        cat = ExpenseCategory(**item, is_active=True)
        db.add(cat)
    db.commit()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ADVANCE REQUESTS & SETTLEMENTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# ── Advance Request schemas ──────────────────────────────────────────────────
class AdvanceRequestSubmit(BaseModel):
    amount: float
    purpose: str
    project_code: Optional[str] = None
    required_date: Optional[date] = None
    attachment_filename: Optional[str] = None
    is_submit: bool = True # True = submitted, False = draft
    lines: Optional[List['SettlementLineInput']] = []

class AdvanceAction(BaseModel):
    remarks: Optional[str] = None

class ClarifyAction(BaseModel):
    remarks: str

# Settlement Line schema
class SettlementLineInput(BaseModel):
    date: date
    expense_type: str
    cost_code: Optional[str] = None
    cost_to: Optional[str] = None
    from_location: Optional[str] = None
    to_location: Optional[str] = None
    description: Optional[str] = None
    paid_to: Optional[str] = None
    gst_number: Optional[str] = None
    gst_rate: Optional[float] = 0.0
    amount: float
    bill_attachments: Optional[List[str]] = []
    account_verification: Optional[str] = None

class SettlementSubmit(BaseModel):
    lines: List[SettlementLineInput]
    is_submit: bool = True # True = submit, False = save as draft


# ── Serializers ──────────────────────────────────────────────────────────────
def _ser_settlement_line(l: ExpenseAdvanceSettlementLine) -> dict:
    return {
        "id": l.id,
        "advance_id": l.advance_id,
        "date": str(l.date) if l.date else None,
        "expense_type": l.expense_type,
        "cost_code": l.cost_code,
        "cost_to": l.cost_to,
        "from_location": l.from_location,
        "to_location": l.to_location,
        "description": l.description,
        "paid_to": l.paid_to,
        "gst_number": l.gst_number,
        "gst_rate": float(l.gst_rate or 0),
        "amount": float(l.amount or 0),
        "bill_attachments": l.bill_attachments or [],
        "account_verification": l.account_verification
    }

def _ser_advance(a: ExpenseAdvanceRequest) -> dict:
    return {
        "id": a.id,
        "reference": a.reference,
        "employee_id": a.employee_id,
        "employee_name": a.employee.name if a.employee else None,
        "employee_code": a.employee.employee_id if a.employee else None,
        "amount": float(a.amount or 0),
        "purpose": a.purpose,
        "project_code": a.project_code,
        "required_date": str(a.required_date) if a.required_date else None,
        "attachment_filename": a.attachment_filename,
        "status": a.status,
        
        "approver_id": a.approver_id,
        "approver_name": a.approver.name if a.approver else None,
        
        "l1_approver_id": a.l1_approver_id,
        "l1_approver_name": a.l1_approver.name if a.l1_approver else None,
        "l1_status": a.l1_status,
        "l1_remarks": a.l1_remarks,
        "l1_approved_at": str(a.l1_approved_at) if a.l1_approved_at else None,
        
        "l2_approver_id": a.l2_approver_id,
        "l2_approver_name": a.l2_approver.name if a.l2_approver else None,
        "l2_status": a.l2_status,
        "l2_remarks": a.l2_remarks,
        "l2_approved_at": str(a.l2_approved_at) if a.l2_approved_at else None,
        
        "clarification_remarks": a.clarification_remarks,
        
        "created_at": str(a.created_at) if a.created_at else None,
        "updated_at": str(a.updated_at) if a.updated_at else None,
        
        "lines": [_ser_settlement_line(line) for line in a.settlement_lines] if a.settlement_lines else []
    }

def _ser_ledger(l: ExpenseAdvanceLedger) -> dict:
    return {
        "id": l.id,
        "employee_id": l.employee_id,
        "advance_id": l.advance_id,
        "advance_ref": l.advance.reference if l.advance else None,
        "transaction_type": l.transaction_type,
        "amount": float(l.amount or 0),
        "running_balance": float(l.running_balance or 0),
        "description": l.description,
        "created_at": str(l.created_at) if l.created_at else None
    }


# ── Advance Notification Helper ──────────────────────────────────────────────
def _notify_advance(db: Session, user_id: int, title: str, message: str, ref_id: int = None):
    # 1. In-app notification
    notif = HRNotification(user_id=user_id, title=title, message=message,
                           reference_type="expense_advance", reference_id=ref_id)
    db.add(notif)
    
    # 2. Push notification
    try:
        from app.utils.push_service import send_push_to_user
        send_push_to_user(user_id, title, message, "expense_advance", ref_id, db)
    except Exception as e:
        print(f"Failed to send push: {e}")
        
    # 3. Email notification
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if user and user.email:
            from app.utils.email_service import send_email
            subject = f"KIM ERP: {title}"
            body_html = f"""
            <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
                    <h2 style="color: #195402;">KIM ERP Notification</h2>
                    <p><strong>{title}</strong></p>
                    <p>{message}</p>
                    <br/>
                    <hr style="border: none; border-top: 1px solid #eee;" />
                    <p style="font-size: 12px; color: #888;">This is an automated notification from KIM ERP. Please do not reply to this email.</p>
                </body>
            </html>
            """
            send_email(db, user.email, subject, body_html)
    except Exception as e:
        print(f"Failed to send email: {e}")


# ── Unique Advance Record Sequence Helper ────────────────────────────────────
def _next_advance_ref(db: Session) -> str:
    year = datetime.utcnow().year
    count = db.query(func.count(ExpenseAdvanceRequest.id)).filter(
        func.extract('year', ExpenseAdvanceRequest.created_at) == year
    ).scalar() or 0
    return f"ADV-{year}-{str(count + 1).zfill(6)}"


# ── Ledger Transaction Helper ────────────────────────────────────────────────
def _log_ledger_transaction(db: Session, employee_id: int, amount: float, tx_type: str, desc: str, advance_id: Optional[int] = None) -> float:
    # Fetch employee's last ledger transaction to calculate current balance
    last_tx = db.query(ExpenseAdvanceLedger).filter(
        ExpenseAdvanceLedger.employee_id == employee_id
    ).order_by(ExpenseAdvanceLedger.created_at.desc(), ExpenseAdvanceLedger.id.desc()).first()
    prev_balance = last_tx.running_balance if last_tx else 0.0
    
    if tx_type == "credit":
        new_balance = prev_balance + amount
    else:
        new_balance = prev_balance - amount
        
    entry = ExpenseAdvanceLedger(
        employee_id=employee_id,
        advance_id=advance_id,
        transaction_type=tx_type,
        amount=amount,
        running_balance=new_balance,
        description=desc,
        created_at=datetime.utcnow()
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return new_balance


def send_advance_request_email(db: Session, advance: ExpenseAdvanceRequest):
    """Send formatted Cash Advance Request notification email to Approver matching Excel format."""
    try:
        emp = advance.employee
        if not emp:
            return
        
        # Determine recipient manager or HR admin email
        approver = db.query(HREmployee).filter(HREmployee.id == advance.approver_id).first() if advance.approver_id else None
        recipient_user = (approver.user if (approver and approver.user) else None)
        
        if not recipient_user or not recipient_user.email:
            # Fallback to L1/L2 approver or HR Admin
            admin_user = db.query(User).filter(User.is_superadmin == True, User.email != None).first()
            recipient_user = admin_user
            
        if not recipient_user or not recipient_user.email:
            return
            
        designation = getattr(emp, 'designation', 'Employee') or 'Employee'
        req_date = advance.created_at.strftime('%d-%m-%Y') if advance.created_at else date.today().strftime('%d-%m-%Y')
        required_date_str = advance.required_date.strftime('%d-%m-%Y') if advance.required_date else req_date
        
        lines = advance.lines or []
        line_rows = ""
        if lines:
            for idx, l in enumerate(lines, 1):
                desc_text = f"<b>{l.expense_type or 'Item'}</b> - {l.description or ''}" if l.expense_type else (l.description or 'Advance Line Item')
                line_rows += f"""
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 10px; text-align: center; font-weight: 700; color: #64748b;">{idx}</td>
                    <td style="padding: 10px; color: #1e293b;">{desc_text}</td>
                    <td style="padding: 10px; text-align: right; font-weight: 700; color: #0f172a;">₹ {l.amount:,.2f}</td>
                </tr>
                """
        else:
            line_rows = f"""
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px; text-align: center; font-weight: 700; color: #64748b;">1</td>
                <td style="padding: 10px; color: #1e293b;">{advance.purpose or 'Cash Advance Request'}</td>
                <td style="padding: 10px; text-align: right; font-weight: 700; color: #0f172a;">₹ {advance.amount:,.2f}</td>
            </tr>
            """
            
        subject = f"📌 Cash Advance Request Notice - {emp.name} ({advance.reference or 'New'})"
        
        body_html = f"""
        <div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 680px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
          <div style="background: #15803d; padding: 22px 28px; color: #ffffff;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.3px;">📌 Cash Advance Request Notice</h2>
            <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.92;">Action Required: Employee Cash Advance Approval Request</p>
          </div>
          
          <div style="padding: 28px; color: #1e293b;">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13.5px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
              <tr>
                <td style="padding: 8px 12px; font-weight: 700; color: #475569; width: 160px;">Name of the Employee:</td>
                <td style="padding: 8px 12px; font-weight: 700; color: #0f172a;">{emp.name}</td>
                <td style="padding: 8px 12px; font-weight: 700; color: #475569; width: 140px;">Requested Date:</td>
                <td style="padding: 8px 12px; font-weight: 600; color: #0f172a;">{req_date}</td>
              </tr>
              <tr>
                <td style="padding: 8px 12px; font-weight: 700; color: #475569;">Designation:</td>
                <td style="padding: 8px 12px; color: #0f172a;">{designation}</td>
                <td style="padding: 8px 12px; font-weight: 700; color: #475569;">Required Date:</td>
                <td style="padding: 8px 12px; font-weight: 600; color: #0f172a;">{required_date_str}</td>
              </tr>
            </table>

            <h3 style="font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin: 20px 0 10px 0;">
              Itemized Advance Breakdown
            </h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12.5px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
              <thead>
                <tr style="background: #f1f5f9; border-bottom: 1px solid #cbd5e1; text-transform: uppercase; color: #475569; font-size: 11px; letter-spacing: 0.5px;">
                  <th style="padding: 10px; text-align: center; width: 45px;">S.no</th>
                  <th style="padding: 10px; text-align: left;">Description</th>
                  <th style="padding: 10px; text-align: right; width: 130px;">Amount</th>
                </tr>
              </thead>
              <tbody>
                {line_rows}
              </tbody>
              <tfoot>
                <tr style="background: #dcfce7; font-weight: bold; font-size: 14px; border-top: 2px solid #22c55e;">
                  <td colspan="2" style="padding: 12px 10px; text-align: right; color: #15803d; text-transform: uppercase; font-size: 12px;">Total Amount:</td>
                  <td style="padding: 12px 10px; text-align: right; color: #15803d; font-size: 16px; font-weight: 800;">₹ {advance.amount:,.2f}</td>
                </tr>
              </tfoot>
            </table>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <div style="font-weight: 700; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Purpose:</div>
              <div style="font-size: 13.5px; color: #0f172a; line-height: 1.5;">{advance.purpose or 'Cash Advance Request'}</div>
            </div>

            <div style="text-align: center; margin-top: 28px;">
              <a href="https://app.konwertindiamotors.com/expenses/approvals" style="background: #15803d; color: #ffffff; padding: 13px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block; box-shadow: 0 4px 10px rgba(21,128,61,0.25);">
                Review & Approve Request
              </a>
            </div>
          </div>
        </div>
        """
        from app.utils.email_service import send_email
        send_email(db, recipient_user.email, subject, body_html)
    except Exception as e:
        print(f"Failed to send advance email: {e}")


# ── API endpoints ───────────────────────────────────────────────────────────

@router.post("/advances")
def create_advance_request(
    data: AdvanceRequestSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.auth import get_current_employee
    emp = get_current_employee(current_user, db)
    
    status_str = "submitted" if data.is_submit else "draft"
    
    advance = ExpenseAdvanceRequest(
        employee_id=emp.id,
        amount=data.amount,
        purpose=data.purpose,
        project_code=data.project_code,
        required_date=data.required_date,
        attachment_filename=data.attachment_filename,
        status=status_str,
        approver_id=emp.manager_id if status_str == "submitted" else None,
        l1_approver_id=emp.manager_id if status_str == "submitted" else None,
        l2_approver_id=getattr(emp, "manager_l2_id", None) if status_str == "submitted" else None,
        l1_status="pending" if status_str == "submitted" else None
    )
    db.add(advance)
    db.commit()
    db.refresh(advance)
    
    if data.lines:
        for l in data.lines:
            s_line = ExpenseAdvanceSettlementLine(
                advance_id=advance.id,
                date=l.date,
                expense_type=l.expense_type,
                cost_code=l.cost_code,
                cost_to=l.cost_to,
                from_location=l.from_location,
                to_location=l.to_location,
                description=l.description,
                paid_to=l.paid_to,
                gst_number=l.gst_number,
                gst_rate=l.gst_rate or 0.0,
                amount=l.amount,
                bill_attachments=l.bill_attachments or [],
                account_verification=l.account_verification
            )
            db.add(s_line)
        db.commit()
    
    if status_str == "submitted":
        send_advance_request_email(db, advance)
        if emp.manager_id:
            manager = db.query(HREmployee).filter(HREmployee.id == emp.manager_id).first()
            if manager and manager.user_id:
                _notify_advance(db, manager.user_id,
                                "New Advance Request Pending",
                                f"{emp.name} submitted an advance request of \u20b9{data.amount:,.2f} for approval.",
                                advance.id)
                db.commit()
            
    return _ser_advance(advance)


@router.put("/advances/{adv_id}")
def update_advance_request(
    adv_id: int,
    data: AdvanceRequestSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.auth import get_current_employee
    emp = get_current_employee(current_user, db)
    advance = db.query(ExpenseAdvanceRequest).filter(ExpenseAdvanceRequest.id == adv_id).first()
    if not advance:
        raise HTTPException(404, "Advance request not found")
        
    if advance.employee_id != emp.id:
        raise HTTPException(403, "Access denied")
        
    if advance.status not in ("draft", "clarification_pending"):
        raise HTTPException(400, f"Cannot update a request that is already {advance.status}")
        
    status_str = "submitted" if data.is_submit else "draft"
    
    advance.amount = data.amount
    advance.purpose = data.purpose
    advance.project_code = data.project_code
    advance.required_date = data.required_date
    if data.attachment_filename is not None:
        advance.attachment_filename = data.attachment_filename
    advance.status = status_str
    
    if status_str == "submitted":
        advance.approver_id = emp.manager_id
        advance.l1_approver_id = emp.manager_id
        advance.l2_approver_id = getattr(emp, "manager_l2_id", None)
        advance.l1_status = "pending"
        advance.l2_status = None
        advance.clarification_remarks = None
        
    advance.updated_at = datetime.utcnow()
    db.commit()
    
    if status_str == "submitted" and emp.manager_id:
        manager = db.query(HREmployee).filter(HREmployee.id == emp.manager_id).first()
        if manager and manager.user_id:
            _notify_advance(db, manager.user_id,
                            "Advance Request Resubmitted",
                            f"{emp.name} resubmitted advance request of \u20b9{data.amount:,.2f} for approval.",
                            advance.id)
            db.commit()
            
    return _ser_advance(advance)


@router.get("/advances/my")
def list_my_advances(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.auth import get_current_employee_optional
    emp = get_current_employee_optional(current_user, db)
    if not emp:
        return []
    q = db.query(ExpenseAdvanceRequest).filter(ExpenseAdvanceRequest.employee_id == emp.id)
    if status:
        q = q.filter(ExpenseAdvanceRequest.status == status)
    return [_ser_advance(a) for a in q.order_by(ExpenseAdvanceRequest.created_at.desc()).all()]


@router.get("/advances/pending-approvals")
def list_pending_advance_approvals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.auth import get_current_employee_optional
    is_admin = is_hr_admin(current_user, db)
    emp = get_current_employee_optional(current_user, db)
    
    # Pending either request approval or settlement approval
    q = db.query(ExpenseAdvanceRequest).filter(
        ExpenseAdvanceRequest.status.in_(["submitted", "under_review", "settlement_submitted"])
    )
    
    if not is_admin:
        if not emp:
            return []
        q = q.filter(ExpenseAdvanceRequest.approver_id == emp.id)
        
    return [_ser_advance(a) for a in q.order_by(ExpenseAdvanceRequest.created_at.desc()).all()]


@router.get("/advances/ledger")
def get_advance_ledger(
    employee_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.auth import get_current_employee_optional
    is_admin = is_hr_admin(current_user, db)
    emp = get_current_employee_optional(current_user, db)
    
    target_emp_id = employee_id if (is_admin and employee_id) else (emp.id if emp else None)
    if not target_emp_id:
        return {
            "opening_balance": 0.0,
            "unsettled_amount": 0.0,
            "reimbursement_pending": 0.0,
            "balance": 0.0,
            "net_balance": 0.0,
            "transactions": []
        }
        
    target_emp = db.query(HREmployee).filter(HREmployee.id == target_emp_id).first()
    
    txs = db.query(ExpenseAdvanceLedger).filter(
        ExpenseAdvanceLedger.employee_id == target_emp_id
    ).order_by(ExpenseAdvanceLedger.created_at.desc(), ExpenseAdvanceLedger.id.desc()).all()
    
    # Calculate unsettled advances (advances paid/disbursed or partially settled)
    advances = db.query(ExpenseAdvanceRequest).filter(
        ExpenseAdvanceRequest.employee_id == target_emp_id,
        ExpenseAdvanceRequest.status.in_(["paid", "partially_settled", "approved"])
    ).all()
    unsettled_amount = sum(a.amount or 0.0 for a in advances)
    
    # Calculate reimbursement pending (approved expense claims pending payment)
    claims = db.query(ExpenseClaim).filter(
        ExpenseClaim.employee_id == target_emp_id,
        ExpenseClaim.status == "approved"
    ).all()
    reimbursement_pending = sum(c.amount or 0.0 for c in claims)
    
    last_tx = txs[0] if txs else None
    balance = last_tx.running_balance if last_tx else 0.0
    opening_balance = 0.0 # Standard default
    
    return {
        "employee_id": target_emp_id,
        "employee_name": target_emp.name if target_emp else "",
        "opening_balance": opening_balance,
        "unsettled_amount": unsettled_amount,
        "reimbursement_pending": reimbursement_pending,
        "balance": balance,
        "net_balance": opening_balance + unsettled_amount - reimbursement_pending,
        "transactions": [_ser_ledger(t) for t in txs]
    }


@router.get("/ledger/summary")
def get_all_employee_ledgers_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List summary for all active employees (Admin/Finance view)."""
    if not is_hr_admin(current_user, db):
        raise HTTPException(403, "Admin view only")
        
    employees = db.query(HREmployee).filter(HREmployee.is_active == True).order_by(HREmployee.name.asc()).all()
    result = []
    for emp in employees:
        advances = db.query(ExpenseAdvanceRequest).filter(
            ExpenseAdvanceRequest.employee_id == emp.id,
            ExpenseAdvanceRequest.status.in_(["paid", "partially_settled", "approved"])
        ).all()
        unsettled = sum(a.amount or 0.0 for a in advances)
        
        claims = db.query(ExpenseClaim).filter(
            ExpenseClaim.employee_id == emp.id,
            ExpenseClaim.status == "approved"
        ).all()
        pending_reimb = sum(c.amount or 0.0 for c in claims)
        
        last_tx = db.query(ExpenseAdvanceLedger).filter(
            ExpenseAdvanceLedger.employee_id == emp.id
        ).order_by(ExpenseAdvanceLedger.created_at.desc(), ExpenseAdvanceLedger.id.desc()).first()
        bal = last_tx.running_balance if last_tx else 0.0
        
        result.append({
            "employee_id": emp.id,
            "employee_name": emp.name,
            "employee_code": emp.employee_code,
            "department": emp.department,
            "opening_balance": 0.0,
            "unsettled_amount": unsettled,
            "reimbursement_pending": pending_reimb,
            "net_balance": unsettled - pending_reimb,
            "ledger_balance": bal,
        })
    return result


@router.get("/advances/reports")
def get_advances_report(
    employee_id: Optional[int] = None,
    status: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    project_code: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not is_hr_admin(current_user, db):
        raise HTTPException(403, "Admin view only")
        
    q = db.query(ExpenseAdvanceRequest)
    if employee_id:
        q = q.filter(ExpenseAdvanceRequest.employee_id == employee_id)
    if status:
        q = q.filter(ExpenseAdvanceRequest.status == status)
    if project_code:
        q = q.filter(ExpenseAdvanceRequest.project_code.ilike(f"%{project_code}%"))
    if from_date:
        q = q.filter(ExpenseAdvanceRequest.required_date >= from_date)
    if to_date:
        q = q.filter(ExpenseAdvanceRequest.required_date <= to_date)
    if search:
        q = q.filter(
            (ExpenseAdvanceRequest.reference.ilike(f"%{search}%")) |
            (ExpenseAdvanceRequest.purpose.ilike(f"%{search}%"))
        )
        
    return [_ser_advance(a) for a in q.order_by(ExpenseAdvanceRequest.created_at.desc()).all()]


@router.get("/advances/{adv_id}")
def get_advance_request(
    adv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.auth import get_current_employee_optional
    advance = db.query(ExpenseAdvanceRequest).filter(ExpenseAdvanceRequest.id == adv_id).first()
    if not advance:
        raise HTTPException(404, "Advance request not found")
        
    if not is_hr_admin(current_user, db):
        emp = get_current_employee_optional(current_user, db)
        if not emp or (
            advance.employee_id != emp.id and
            advance.l1_approver_id != emp.id and
            advance.l2_approver_id != emp.id
        ):
            raise HTTPException(403, "Access denied")
            
    return _ser_advance(advance)


@router.post("/advances/{adv_id}/approve")
def approve_advance_request(
    adv_id: int,
    data: AdvanceAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    advance = db.query(ExpenseAdvanceRequest).filter(ExpenseAdvanceRequest.id == adv_id).first()
    if not advance:
        raise HTTPException(404, "Advance request not found")
        
    if advance.status not in ("submitted", "under_review"):
        raise HTTPException(400, f"Cannot approve request in status {advance.status}")
        
    from app.auth import get_current_employee_optional
    is_admin = is_hr_admin(current_user, db)
    emp = get_current_employee_optional(current_user, db)
    
    if not is_admin and (not emp or advance.approver_id != emp.id):
        raise HTTPException(403, "You are not authorized to approve this request")
        
    is_l1 = (advance.l1_approver_id == emp.id) if emp else False
    is_l2 = (advance.l2_approver_id == emp.id) if emp else False
    is_super = is_admin
    final_approval = False
    
    if is_l1 and not is_l2 and advance.l1_status == "pending":
        advance.l1_status = "approved"
        advance.l1_remarks = data.remarks
        advance.l1_approved_at = datetime.utcnow()
        if advance.l2_approver_id:
            advance.status = "under_review"
            advance.approver_id = advance.l2_approver_id
            l2_mgr = db.query(HREmployee).filter(HREmployee.id == advance.l2_approver_id).first()
            if l2_mgr and l2_mgr.user_id:
                _notify_advance(db, l2_mgr.user_id,
                                "Advance Request Pending (L2)",
                                f"{advance.employee.name}'s advance request of \u20b9{advance.amount:,.2f} approved by L1. Pending your approval.",
                                advance.id)
            db.commit()
            return {"message": "Approved (L1), pending L2 approval", "id": advance.id}
        else:
            final_approval = True
    elif is_l2 and (advance.l2_status == "pending" or not advance.l2_status):
        advance.l2_status = "approved"
        advance.l2_remarks = data.remarks
        advance.l2_approved_at = datetime.utcnow()
        final_approval = True
    elif is_super:
        final_approval = True
    else:
        raise HTTPException(400, "You cannot approve this request in its current state.")
        
    if final_approval:
        advance.status = "approved"
        advance.reference = _next_advance_ref(db)
        advance.approved_at = datetime.utcnow()
        advance.approver_remarks = data.remarks
        
        if advance.employee and advance.employee.user_id:
            _notify_advance(db, advance.employee.user_id,
                            "Advance Request Approved (Pending Disburse) ✓",
                            f"Your advance request {advance.reference} of ₹{advance.amount:,.2f} was approved by manager. Pending Accountant payout.",
                            advance.id)
            
    db.commit()
    return {"message": "Approved by Manager (Pending Accountant Payout)", "id": advance.id}


@router.post("/advances/{adv_id}/payout")
def payout_advance_request(
    adv_id: int,
    data: AdvanceAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Stage 3: Accountant payout / disburse action that credits amount to employee ledger."""
    advance = db.query(ExpenseAdvanceRequest).filter(ExpenseAdvanceRequest.id == adv_id).first()
    if not advance:
        raise HTTPException(404, "Advance request not found")
        
    if advance.status != "approved":
        raise HTTPException(400, f"Cannot pay out advance in status {advance.status}. Must be approved first.")
        
    if not is_hr_admin(current_user, db):
        raise HTTPException(403, "Accountant / Admin access required for payout")
        
    advance.status = "paid"
    advance.paid_at = datetime.utcnow()
    advance.payout_remarks = data.remarks
    
    # ── Stage 3 Accountant Action: Credit Employee Ledger ───────────────────
    _log_ledger_transaction(
        db=db,
        employee_id=advance.employee_id,
        amount=advance.amount,
        tx_type="credit",
        desc=f"Advance Paid Out: {advance.reference}",
        advance_id=advance.id
    )
    
    if advance.employee and advance.employee.user_id:
        _notify_advance(db, advance.employee.user_id,
                        "Advance Amount Disbursed 💵",
                        f"Your advance amount of ₹{advance.amount:,.2f} ({advance.reference}) has been disbursed by Accounts and credited to your ledger.",
                        advance.id)
                        
    db.commit()
    return {"message": "Advance disbursed and credited to employee ledger successfully", "id": advance.id}


@router.post("/advances/{adv_id}/reject")
def reject_advance_request(
    adv_id: int,
    data: AdvanceAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    advance = db.query(ExpenseAdvanceRequest).filter(ExpenseAdvanceRequest.id == adv_id).first()
    if not advance:
        raise HTTPException(404, "Advance request not found")
        
    if advance.status not in ("submitted", "under_review"):
        raise HTTPException(400, f"Cannot reject request in status {advance.status}")
        
    from app.auth import get_current_employee_optional
    is_admin = is_hr_admin(current_user, db)
    emp = get_current_employee_optional(current_user, db)
    
    if not is_admin and (not emp or advance.approver_id != emp.id):
        raise HTTPException(403, "You are not authorized to reject this request")
        
    is_l1 = (advance.l1_approver_id == emp.id) if emp else False
    is_l2 = (advance.l2_approver_id == emp.id) if emp else False
    
    if is_l1 and advance.l1_status == "pending":
        advance.l1_status = "rejected"
        advance.l1_remarks = data.remarks
        advance.l1_approved_at = datetime.utcnow()
    elif is_l2 and (advance.l2_status == "pending" or not advance.l2_status):
        advance.l2_status = "rejected"
        advance.l2_remarks = data.remarks
        advance.l2_approved_at = datetime.utcnow()
        
    advance.status = "rejected"
    advance.approved_at = datetime.utcnow()
    advance.approver_remarks = data.remarks
    
    if advance.employee and advance.employee.user_id:
        _notify_advance(db, advance.employee.user_id,
                        "Advance Request Rejected \u2717",
                        f"Your advance request was rejected. Remarks: {data.remarks or 'None'}",
                        advance.id)
                        
    db.commit()
    return {"message": "Rejected"}


@router.post("/advances/{adv_id}/clarify")
def clarify_advance_request(
    adv_id: int,
    data: ClarifyAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    advance = db.query(ExpenseAdvanceRequest).filter(ExpenseAdvanceRequest.id == adv_id).first()
    if not advance:
        raise HTTPException(404, "Advance request not found")
        
    if advance.status not in ("submitted", "under_review"):
        raise HTTPException(400, "Request is not pending review")
        
    from app.auth import get_current_employee_optional
    is_admin = is_hr_admin(current_user, db)
    emp = get_current_employee_optional(current_user, db)
    
    if not is_admin and (not emp or advance.approver_id != emp.id):
        raise HTTPException(403, "Access denied")
        
    advance.status = "clarification_pending"
    advance.clarification_remarks = data.remarks
    
    if advance.employee and advance.employee.user_id:
        _notify_advance(db, advance.employee.user_id,
                        "Advance Request Clarification Needed \u2753",
                        f"Your advance request needs clarification. Remarks: {data.remarks}",
                        advance.id)
                        
    db.commit()
    return {"message": "Sent back for clarification"}


@router.post("/advances/{adv_id}/settle")
def submit_settlement(
    adv_id: int,
    data: SettlementSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    advance = db.query(ExpenseAdvanceRequest).filter(ExpenseAdvanceRequest.id == adv_id).first()
    if not advance:
        raise HTTPException(404, "Advance request not found")
        
    from app.auth import get_current_employee
    emp = get_current_employee(current_user, db)
    
    if advance.employee_id != emp.id:
        raise HTTPException(403, "Access denied")
        
    if advance.status not in ("approved", "settlement_pending"):
        raise HTTPException(400, f"Cannot settle advance in status {advance.status}")
        
    # Clear existing settlement lines
    db.query(ExpenseAdvanceSettlementLine).filter(ExpenseAdvanceSettlementLine.advance_id == adv_id).delete()
    
    # Add new lines
    for line in data.lines:
        s_line = ExpenseAdvanceSettlementLine(
            advance_id=adv_id,
            date=line.date,
            expense_type=line.expense_type,
            cost_code=line.cost_code,
            cost_to=line.cost_to,
            from_location=line.from_location,
            to_location=line.to_location,
            description=line.description,
            paid_to=line.paid_to,
            gst_number=line.gst_number,
            gst_rate=line.gst_rate or 0.0,
            amount=line.amount,
            bill_attachments=line.bill_attachments or [],
            account_verification=line.account_verification
        )
        db.add(s_line)
        
    if data.is_submit:
        advance.status = "settlement_submitted"
        # Reset approval fields for settlement review (routes to managers)
        advance.approver_id = emp.manager_id
        advance.l1_approver_id = emp.manager_id
        advance.l2_approver_id = getattr(emp, "manager_l2_id", None)
        advance.l1_status = "pending"
        advance.l2_status = None
        
        if emp.manager_id:
            manager = db.query(HREmployee).filter(HREmployee.id == emp.manager_id).first()
            if manager and manager.user_id:
                _notify_advance(db, manager.user_id,
                                "Expense Settlement Submitted",
                                f"{emp.name} submitted expense settlement sheet for advance {advance.reference}.",
                                advance.id)
    else:
        advance.status = "settlement_pending"
        
    db.commit()
    db.refresh(advance)
    return _ser_advance(advance)


@router.post("/advances/{adv_id}/settle/approve")
def approve_settlement(
    adv_id: int,
    data: AdvanceAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    advance = db.query(ExpenseAdvanceRequest).filter(ExpenseAdvanceRequest.id == adv_id).first()
    if not advance:
        raise HTTPException(404, "Advance request not found")
        
    if advance.status != "settlement_submitted":
        raise HTTPException(400, "Settlement is not submitted for review")
        
    from app.auth import get_current_employee_optional
    is_admin = is_hr_admin(current_user, db)
    emp = get_current_employee_optional(current_user, db)
    
    if not is_admin and (not emp or advance.approver_id != emp.id):
        raise HTTPException(403, "Access denied")
        
    is_l1 = (advance.l1_approver_id == emp.id) if emp else False
    is_l2 = (advance.l2_approver_id == emp.id) if emp else False
    is_super = is_admin
    final_approval = False
    
    if is_l1 and not is_l2 and advance.l1_status == "pending":
        advance.l1_status = "approved"
        advance.l1_remarks = data.remarks
        advance.l1_approved_at = datetime.utcnow()
        if advance.l2_approver_id:
            advance.approver_id = advance.l2_approver_id
            l2_mgr = db.query(HREmployee).filter(HREmployee.id == advance.l2_approver_id).first()
            if l2_mgr and l2_mgr.user_id:
                _notify_advance(db, l2_mgr.user_id,
                                "Settlement Review Pending (L2)",
                                f"{advance.employee.name}'s expense settlement for {advance.reference} approved by L1. Pending L2 review.",
                                advance.id)
            db.commit()
            return {"message": "Approved (L1), pending L2 review", "id": advance.id}
        else:
            final_approval = True
    elif is_l2 and (advance.l2_status == "pending" or not advance.l2_status):
        advance.l2_status = "approved"
        advance.l2_remarks = data.remarks
        advance.l2_approved_at = datetime.utcnow()
        final_approval = True
    elif is_super:
        final_approval = True
    else:
        raise HTTPException(400, "You cannot approve this settlement in its current state.")
        
    if final_approval:
        advance.status = "settlement_approved"
        advance.approved_at = datetime.utcnow()
        advance.approver_remarks = data.remarks
        
        # Debit user's ledger!
        total_claimed = sum(line.amount for line in advance.settlement_lines)
        _log_ledger_transaction(
            db=db,
            employee_id=advance.employee_id,
            amount=total_claimed,
            tx_type="debit",
            desc=f"Expenses settled: {advance.reference}",
            advance_id=advance.id
        )
        
        if advance.employee and advance.employee.user_id:
            _notify_advance(db, advance.employee.user_id,
                            "Settlement Approved \u2713",
                            f"Your expense settlement for advance {advance.reference} has been approved.",
                            advance.id)
            
    db.commit()
    return {"message": "Settlement Approved", "id": advance.id}


@router.post("/advances/{adv_id}/settle/reject")
def reject_settlement(
    adv_id: int,
    data: AdvanceAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    advance = db.query(ExpenseAdvanceRequest).filter(ExpenseAdvanceRequest.id == adv_id).first()
    if not advance:
        raise HTTPException(404, "Advance request not found")
        
    if advance.status != "settlement_submitted":
        raise HTTPException(400, "Settlement is not submitted for review")
        
    from app.auth import get_current_employee_optional
    is_admin = is_hr_admin(current_user, db)
    emp = get_current_employee_optional(current_user, db)
    
    if not is_admin and (not emp or advance.approver_id != emp.id):
        raise HTTPException(403, "Access denied")
        
    advance.status = "settlement_pending" # send back to employee to fix lines
    advance.clarification_remarks = data.remarks
    
    if advance.employee and advance.employee.user_id:
        _notify_advance(db, advance.employee.user_id,
                        "Expense Settlement Rejected \u2717",
                        f"Your expense settlement for {advance.reference} was rejected. Remarks: {data.remarks}",
                        advance.id)
                        
    db.commit()
    return {"message": "Settlement Rejected"}


@router.post("/advances/{adv_id}/close")
def close_advance(
    adv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not is_hr_admin(current_user, db):
        raise HTTPException(403, "HR Admin access required to close advances")
        
    advance = db.query(ExpenseAdvanceRequest).filter(ExpenseAdvanceRequest.id == adv_id).first()
    if not advance:
        raise HTTPException(404, "Advance request not found")
        
    if advance.status != "settlement_approved":
        raise HTTPException(400, f"Cannot close advance in status {advance.status}")
        
    total_claimed = sum(line.amount for line in advance.settlement_lines)
    diff = advance.amount - total_claimed
    
    if diff > 0:
        _log_ledger_transaction(
            db=db,
            employee_id=advance.employee_id,
            amount=diff,
            tx_type="return",
            desc=f"Remaining balance returned: {advance.reference}",
            advance_id=advance.id
        )
    elif diff < 0:
        _log_ledger_transaction(
            db=db,
            employee_id=advance.employee_id,
            amount=abs(diff),
            tx_type="credit",
            desc=f"Excess expense reimbursement paid: {advance.reference}",
            advance_id=advance.id
        )
        
    advance.status = "closed"
    db.commit()
    
    if advance.employee and advance.employee.user_id:
        _notify_advance(db, advance.employee.user_id,
                        "Advance Account Closed 🔒",
                        f"Your advance account {advance.reference} has been settled and closed.",
                        advance.id)
                        
    return {"message": "Advance closed successfully", "id": advance.id}


