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
from app.expense_models import ExpenseCategory, ExpenseClaim
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
    allowed_types = {"image/jpeg", "image/png", "image/jpg", "application/pdf"}
    if file.content_type not in allowed_types:
        raise HTTPException(400, "Only JPEG, PNG, or PDF files are allowed")
    ext = os.path.splitext(file.filename or "")[1].lower() or ".jpg"
    unique_name = f"{uuid.uuid4().hex}{ext}"
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
