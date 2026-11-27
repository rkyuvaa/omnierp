import os
import secrets
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from app.models import ApprovalActionToken


DEFAULT_PUBLIC_URL = "https://app.konwertindiamotors.com"


def get_public_base_url(origin: str = "") -> str:
    """Resolve the public base URL used in email links."""
    env_url = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
    if env_url:
        return env_url
    clean_origin = (origin or "").strip().rstrip("/")
    if clean_origin:
        return clean_origin
    return DEFAULT_PUBLIC_URL


def create_approval_token(
    db: Session,
    entity_type: str,
    entity_id: int,
    approver_employee_id: Optional[int],
    stage: str = "default",
    expires_days: int = 2,
) -> str:
    """Create and persist a single-use approval action token with 2-day default validity."""
    token = secrets.token_urlsafe(32)
    rec = ApprovalActionToken(
        token=token,
        entity_type=entity_type,
        entity_id=entity_id,
        approver_employee_id=approver_employee_id,
        stage=stage,
        expires_at=datetime.utcnow() + timedelta(days=expires_days),
    )
    db.add(rec)
    db.commit()
    return token


def build_approval_action_urls(
    db: Session,
    entity_type: str,
    entity_id: int,
    approver_employee_id: Optional[int],
    stage: str = "default",
    origin: str = "",
    expires_days: int = 2,
) -> dict:
    """Create a token and return approve_url / reject_url pointing to the public endpoint."""
    token = create_approval_token(
        db=db,
        entity_type=entity_type,
        entity_id=entity_id,
        approver_employee_id=approver_employee_id,
        stage=stage,
        expires_days=expires_days,
    )
    base_url = get_public_base_url(origin)
    return {
        "token": token,
        "approve_url": f"{base_url}/api/public/approvals/{token}?action=approve",
        "reject_url": f"{base_url}/api/public/approvals/{token}?action=reject",
    }


def invalidate_entity_tokens(
    db: Session,
    entity_type: str,
    entity_id: int,
    used_action: str = "superseded",
) -> None:
    """Invalidate any open email tokens for an entity once acted upon in-app or via email."""
    open_tokens = (
        db.query(ApprovalActionToken)
        .filter(
            ApprovalActionToken.entity_type == entity_type,
            ApprovalActionToken.entity_id == entity_id,
            ApprovalActionToken.used_at.is_(None),
        )
        .all()
    )
    now = datetime.utcnow()
    for t in open_tokens:
        t.used_at = now
        t.used_action = used_action
