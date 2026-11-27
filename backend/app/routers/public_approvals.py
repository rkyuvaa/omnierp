import html
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Form, HTTPException, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.expense_models import ExpenseAdvanceRequest
from app.hr_models import HREmployee, HRLeaveRequest, HROnDutyRequest, HRPermissionRequest
from app.models import ApprovalActionToken
from app.utils.approval_tokens import get_public_base_url

router = APIRouter()


def _esc(val) -> str:
    return html.escape("" if val is None else str(val))


def _render_page(title: str, subtitle: str, body_html: str, accent: str = "#195402") -> HTMLResponse:
    portal_url = get_public_base_url("")
    doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{_esc(title)} — KIM ERP</title>
  <style>
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      padding: 28px 16px;
      background: #EEF2F7;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      color: #1e293b;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }}
    .card {{
      width: 100%;
      max-width: 560px;
      background: #ffffff;
      border: 1px solid #cbd5e0;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
    }}
    .header {{
      background: {accent};
      color: #ffffff;
      padding: 22px 28px;
    }}
    .header h1 {{
      margin: 0;
      font-size: 20px;
      font-weight: 700;
    }}
    .header p {{
      margin: 6px 0 0;
      font-size: 13px;
      opacity: 0.9;
    }}
    .content {{
      padding: 26px 28px;
    }}
    .summary {{
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px 18px;
      margin-bottom: 20px;
    }}
    .row {{
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 9px 0;
      border-bottom: 1px solid #e2e8f0;
      font-size: 13.5px;
    }}
    .row:last-child {{
      border-bottom: none;
    }}
    .label {{
      color: #64748b;
      font-weight: 500;
      flex-shrink: 0;
    }}
    .val {{
      color: #0f172a;
      font-weight: 700;
      text-align: right;
      word-break: break-word;
    }}
    label.field-label {{
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #334155;
      margin-bottom: 6px;
    }}
    textarea {{
      width: 100%;
      min-height: 84px;
      padding: 10px 12px;
      border: 1px solid #cbd5e0;
      border-radius: 10px;
      font-family: inherit;
      font-size: 14px;
      resize: vertical;
      margin-bottom: 18px;
    }}
    textarea:focus {{
      outline: none;
      border-color: #195402;
      box-shadow: 0 0 0 3px rgba(25, 84, 2, 0.12);
    }}
    .actions {{
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }}
    .btn {{
      flex: 1;
      min-width: 160px;
      padding: 13px 20px;
      border-radius: 10px;
      font-size: 14.5px;
      font-weight: 700;
      border: none;
      cursor: pointer;
      text-align: center;
      text-decoration: none;
      display: inline-block;
    }}
    .btn-approve {{
      background: #15803d;
      color: #ffffff;
    }}
    .btn-reject {{
      background: #dc2626;
      color: #ffffff;
    }}
    .btn-secondary {{
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e0;
    }}
    .footer {{
      padding: 14px 28px 20px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 12px;
      color: #64748b;
    }}
    .footer a {{
      color: #195402;
      font-weight: 600;
      text-decoration: none;
    }}
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>{_esc(title)}</h1>
      <p>{_esc(subtitle)}</p>
    </div>
    <div class="content">
      {body_html}
    </div>
    <div class="footer">
      KIM ERP &middot; <a href="{_esc(portal_url)}">Open KIM ERP Portal</a>
    </div>
  </div>
</body>
</html>"""
    return HTMLResponse(content=doc)


def _load_entity_summary(db: Session, token_rec: ApprovalActionToken):
    """Return (entity, summary_rows, is_pending, status_message, type_label)."""
    et = token_rec.entity_type
    eid = token_rec.entity_id

    if et == "leave":
        req = db.query(HRLeaveRequest).filter(HRLeaveRequest.id == eid).first()
        if not req:
            return None, [], False, "Leave request not found.", "Leave Request"
        ltype = req.leave_type.name if req.leave_type else "Leave"
        rows = [
            ("Request", f"Leave ({req.reference or req.id})"),
            ("Employee", req.employee.name if req.employee else "Employee"),
            ("Leave Type", ltype),
            ("Duration", f"{req.from_date} to {req.to_date} ({req.total_days} day(s))"),
            ("Reason", req.reason or "No reason provided"),
            ("Current Status", req.status.upper()),
        ]
        pending = req.status == "pending"
        msg = "" if pending else f"This leave request is already {req.status}."
        return req, rows, pending, msg, "Leave Request"

    if et == "onduty":
        req = db.query(HROnDutyRequest).filter(HROnDutyRequest.id == eid).first()
        if not req:
            return None, [], False, "On-Duty request not found.", "On-Duty Request"
        rows = [
            ("Request", f"On-Duty ({req.reference or req.id})"),
            ("Employee", req.employee.name if req.employee else "Employee"),
            ("Date", str(req.date)),
            ("Time", f"{req.from_time} – {req.to_time}"),
            ("Location", req.work_location or "N/A"),
            ("Purpose", req.purpose or "Not specified"),
            ("Current Status", req.status.upper()),
        ]
        pending = req.status == "pending"
        msg = "" if pending else f"This On-Duty request is already {req.status}."
        return req, rows, pending, msg, "On-Duty Request"

    if et == "permission":
        req = db.query(HRPermissionRequest).filter(HRPermissionRequest.id == eid).first()
        if not req:
            return None, [], False, "Permission request not found.", "Permission Request"
        rows = [
            ("Request", f"Permission ({req.reference or req.id})"),
            ("Employee", req.employee.name if req.employee else "Employee"),
            ("Date", str(req.date)),
            ("Session", f"{req.session.capitalize()} Session ({req.duration_hours} hr)"),
            ("Reason", req.reason or "No reason provided"),
            ("Current Status", req.status.upper()),
        ]
        pending = req.status == "pending"
        msg = "" if pending else f"This permission request is already {req.status}."
        return req, rows, pending, msg, "Permission Request"

    if et == "advance":
        adv = db.query(ExpenseAdvanceRequest).filter(ExpenseAdvanceRequest.id == eid).first()
        if not adv:
            return None, [], False, "Cash advance request not found.", "Cash Advance Request"
        rows = [
            ("Request", f"Cash Advance ({adv.reference or f'#{adv.id}'})"),
            ("Employee", adv.employee.name if adv.employee else "Employee"),
            ("Amount", f"₹ {adv.amount:,.2f}"),
            ("Required Date", str(adv.required_date) if adv.required_date else "Not specified"),
            ("Purpose", adv.purpose or "Cash Advance Request"),
            ("Current Status", adv.status.upper()),
        ]
        pending = adv.status in ("submitted", "under_review")
        msg = "" if pending else f"This advance request is already {adv.status}."
        return adv, rows, pending, msg, "Cash Advance Request"

    if et == "advance_settlement":
        adv = db.query(ExpenseAdvanceRequest).filter(ExpenseAdvanceRequest.id == eid).first()
        if not adv:
            return None, [], False, "Expense settlement not found.", "Expense Settlement"
        rows = [
            ("Request", f"Settlement ({adv.reference or f'#{adv.id}'})"),
            ("Employee", adv.employee.name if adv.employee else "Employee"),
            ("Advance Amount", f"₹ {adv.amount:,.2f}"),
            ("Purpose", adv.purpose or "Expense Settlement"),
            ("Current Status", adv.status.upper()),
        ]
        pending = adv.status == "settlement_submitted"
        msg = "" if pending else f"This settlement is currently in status '{adv.status}'."
        return adv, rows, pending, msg, "Expense Settlement"

    if et == "advance_settlement_accounts":
        adv = db.query(ExpenseAdvanceRequest).filter(ExpenseAdvanceRequest.id == eid).first()
        if not adv:
            return None, [], False, "Expense settlement not found.", "Accounts Settlement Verification"
        rows = [
            ("Request", f"Accounts Verification ({adv.reference or f'#{adv.id}'})"),
            ("Employee", adv.employee.name if adv.employee else "Employee"),
            ("Advance Amount", f"₹ {adv.amount:,.2f}"),
            ("Purpose", adv.purpose or "Expense Settlement"),
            ("Current Status", adv.status.upper()),
        ]
        pending = adv.status == "settlement_manager_approved"
        msg = "" if pending else f"This settlement is currently in status '{adv.status}'."
        return adv, rows, pending, msg, "Accounts Settlement Verification"

    return None, [], False, "Unsupported approval type.", "Approval Request"


def _summary_html(rows: list) -> str:
    items = "".join(
        f'<div class="row"><span class="label">{_esc(k)}</span><span class="val">{_esc(v)}</span></div>'
        for k, v in rows
    )
    return f'<div class="summary">{items}</div>'


@router.get("/{token}", response_class=HTMLResponse)
def preview_public_approval(
    token: str,
    action: Optional[str] = "approve",
    db: Session = Depends(get_db),
):
    token_rec = db.query(ApprovalActionToken).filter(ApprovalActionToken.token == token).first()
    if not token_rec:
        return _render_page(
            "Invalid Approval Link",
            "This link could not be found.",
            "<p>Please check your email or log in to KIM ERP to review pending requests.</p>",
            accent="#475569",
        )

    entity, rows, is_pending, status_msg, type_label = _load_entity_summary(db, token_rec)

    if token_rec.used_at is not None:
        used_on = token_rec.used_at.strftime("%Y-%m-%d %H:%M UTC")
        body = (
            (_summary_html(rows) if rows else "")
            + f"<p>This approval link was already used (<strong>{_esc(token_rec.used_action or 'processed')}</strong> on {_esc(used_on)}).</p>"
        )
        return _render_page(f"{type_label} Already Processed", "No further action is needed.", body, accent="#475569")

    if token_rec.expires_at < datetime.utcnow():
        body = (
            (_summary_html(rows) if rows else "")
            + "<p>This 2-day email approval link has expired. Please log in to KIM ERP to act on this request.</p>"
        )
        return _render_page("Approval Link Expired", "Please respond from the KIM ERP portal.", body, accent="#b45309")

    if not entity or not is_pending:
        body = (_summary_html(rows) if rows else "") + f"<p>{_esc(status_msg)}</p>"
        return _render_page(f"{type_label} Unavailable", "Already updated in KIM ERP.", body, accent="#475569")

    chosen = "reject" if (action or "").strip().lower() == "reject" else "approve"
    if chosen == "approve":
        title = f"Confirm Approval — {type_label}"
        subtitle = "Review the details below and click Confirm Approve to submit."
        accent = "#15803d"
        buttons = """
          <button type="submit" name="action" value="approve" class="btn btn-approve">Confirm Approve ✓</button>
          <button type="submit" name="action" value="reject" class="btn btn-secondary">Reject Instead ✗</button>
        """
    else:
        title = f"Confirm Rejection — {type_label}"
        subtitle = "Add an optional rejection reason below and click Confirm Reject."
        accent = "#dc2626"
        buttons = """
          <button type="submit" name="action" value="reject" class="btn btn-reject">Confirm Reject ✗</button>
          <button type="submit" name="action" value="approve" class="btn btn-secondary">Approve Instead ✓</button>
        """

    form_html = f"""
      {_summary_html(rows)}
      <form method="post" action="/api/public/approvals/{_esc(token)}">
        <label class="field-label" for="remarks">Remarks (Optional)</label>
        <textarea id="remarks" name="remarks" placeholder="Enter optional approval remarks or rejection reason..."></textarea>
        <div class="actions">
          {buttons}
        </div>
      </form>
    """
    return _render_page(title, subtitle, form_html, accent=accent)


@router.post("/{token}", response_class=HTMLResponse)
def execute_public_approval(
    token: str,
    request: Request,
    background_tasks: BackgroundTasks,
    action: str = Form(...),
    remarks: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    token_rec = db.query(ApprovalActionToken).filter(ApprovalActionToken.token == token).first()
    if not token_rec:
        return _render_page(
            "Invalid Approval Link",
            "This link could not be found.",
            "<p>Please check your email or log in to KIM ERP.</p>",
            accent="#475569",
        )

    clean_action = (action or "").strip().lower()
    if clean_action not in ("approve", "reject"):
        return _render_page("Invalid Action", "Unsupported response.", "<p>Action must be approve or reject.</p>", accent="#dc2626")

    entity, rows, is_pending, status_msg, type_label = _load_entity_summary(db, token_rec)

    if token_rec.used_at is not None:
        body = (_summary_html(rows) if rows else "") + f"<p>This link has already been used ({_esc(token_rec.used_action)}).</p>"
        return _render_page(f"{type_label} Already Processed", "No further action taken.", body, accent="#475569")

    if token_rec.expires_at < datetime.utcnow():
        body = (_summary_html(rows) if rows else "") + "<p>This 2-day email approval link has expired. Please log in to KIM ERP.</p>"
        return _render_page("Approval Link Expired", "Please respond from the KIM ERP portal.", body, accent="#b45309")

    if not entity or not is_pending:
        body = (_summary_html(rows) if rows else "") + f"<p>{_esc(status_msg)}</p>"
        return _render_page(f"{type_label} Unavailable", "Already updated in KIM ERP.", body, accent="#475569")

    actor_emp = (
        db.query(HREmployee).filter(HREmployee.id == token_rec.approver_employee_id).first()
        if token_rec.approver_employee_id
        else None
    )
    is_super = token_rec.approver_employee_id is None
    clean_remarks = (remarks or "").strip() or None
    origin = request.headers.get("origin") or str(request.base_url).rstrip("/")

    try:
        et = token_rec.entity_type
        if et == "leave":
            from app.routers.hr_leave import process_leave_decision
            res = process_leave_decision(db, entity, clean_action, actor_emp, is_super, clean_remarks, background_tasks, origin=origin)
        elif et == "onduty":
            from app.routers.hr_onduty import process_onduty_decision
            res = process_onduty_decision(db, entity, clean_action, actor_emp, is_super, clean_remarks, background_tasks, origin=origin)
        elif et == "permission":
            from app.routers.hr_permission import process_permission_decision
            res = process_permission_decision(db, entity, clean_action, actor_emp, is_super, clean_remarks, background_tasks)
        elif et == "advance":
            from app.routers.expenses import process_advance_decision
            res = process_advance_decision(db, entity, clean_action, actor_emp, is_super, clean_remarks)
        elif et == "advance_settlement":
            from app.routers.expenses import process_settlement_l1_decision
            res = process_settlement_l1_decision(db, entity, clean_action, actor_emp, is_super, clean_remarks, origin=origin)
        elif et == "advance_settlement_accounts":
            from app.routers.expenses import process_settlement_accounts_decision
            res = process_settlement_accounts_decision(db, entity, clean_action, actor_emp, is_super, clean_remarks)
        else:
            raise HTTPException(400, "Unsupported entity type")
    except HTTPException as exc:
        return _render_page(
            f"Unable to Process {type_label}",
            "Action could not be completed.",
            (_summary_html(rows) if rows else "") + f"<p>{_esc(exc.detail)}</p>",
            accent="#dc2626",
        )

    if token_rec.used_at is None:
        token_rec.used_at = datetime.utcnow()
        token_rec.used_action = clean_action
        db.commit()

    _, updated_rows, _, _, _ = _load_entity_summary(db, token_rec)
    if clean_remarks:
        updated_rows.append(("Your Remarks", clean_remarks))

    if clean_action == "approve":
        title = f"{type_label} Approved ✓"
        accent = "#15803d"
    else:
        title = f"{type_label} Rejected ✗"
        accent = "#dc2626"

    return _render_page(
        title,
        res.get("message") or "Your decision has been recorded.",
        _summary_html(updated_rows) + "<p>Your response has been saved and the employee has been notified.</p>",
        accent=accent,
    )
