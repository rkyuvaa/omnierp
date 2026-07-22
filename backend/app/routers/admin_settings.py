from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.database import get_db
from app.models import User, SystemSetting, EmailTemplate
from app.auth import get_current_user, require_admin
from app.utils.email_service import send_email

router = APIRouter()

class SmtpConfigSchema(BaseModel):
    host: str
    port: int
    username: str
    password: str
    sender_email: str
    sender_name: str
    use_tls: bool = True
    use_ssl: bool = False

class SmtpTestSchema(BaseModel):
    test_email: EmailStr
    config: SmtpConfigSchema

class TemplateUpdateSchema(BaseModel):
    name: str
    subject: str
    body_html: str


@router.get("/settings")
def get_smtp_settings(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Retrieve SMTP Configurations, sanitizing password field for security."""
    setting = db.query(SystemSetting).filter(SystemSetting.key == "smtp_config").first()
    if not setting or not isinstance(setting.value, dict):
        return {
            "host": "localhost",
            "port": 587,
            "username": "",
            "password_configured": False,
            "sender_email": "No-Reply@domain.com",
            "sender_name": "KIM ERP",
            "use_tls": True,
            "use_ssl": False
        }
    
    val = setting.value
    return {
        "host": val.get("host", ""),
        "port": int(val.get("port", 587)),
        "username": val.get("username", ""),
        "password_configured": bool(val.get("password")),
        "sender_email": val.get("sender_email", ""),
        "sender_name": val.get("sender_name", ""),
        "use_tls": val.get("use_tls", True),
        "use_ssl": val.get("use_ssl", False)
    }


@router.post("/settings")
def save_smtp_settings(config: SmtpConfigSchema, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Save SMTP Configurations into system_settings."""
    setting = db.query(SystemSetting).filter(SystemSetting.key == "smtp_config").first()
    
    # Extract values to dict
    val_dict = config.dict()
    
    if setting and isinstance(setting.value, dict):
        # Keep old password if it comes as masked
        if config.password == "******":
            val_dict["password"] = setting.value.get("password", "")
        
        setting.value = val_dict
        setting.updated_at = datetime.utcnow()
    else:
        if config.password == "******":
            val_dict["password"] = ""
        setting = SystemSetting(key="smtp_config", value=val_dict)
        db.add(setting)
        
    db.commit()
    return {"message": "SMTP Configurations saved successfully"}


@router.post("/smtp/test")
def test_smtp_connection(data: SmtpTestSchema, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Fire a test email with the provided (potentially unsaved) credentials."""
    # Build temporary system setting for test
    temp_val = data.config.dict()
    
    # Fallback to current saved password if it comes as masked
    if data.config.password == "******":
        setting = db.query(SystemSetting).filter(SystemSetting.key == "smtp_config").first()
        if setting and isinstance(setting.value, dict):
            temp_val["password"] = setting.value.get("password", "")
        else:
            raise HTTPException(400, "Password required for test connection")

    # Temporarily set SMTP configuration in a localized container dict
    test_db = Session(bind=db.get_bind())
    try:
        # Construct and send a test HTML email
        subject = "KIM ERP: SMTP Connection Test"
        body_html = f"""
        <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #155402; margin-top: 0;">SMTP Connection Verified!</h2>
          <p>This is a system test email sent from <strong>KIM ERP</strong> to confirm your SMTP configuration settings.</p>
          <div style="background-color: #f0fdf4; padding: 15px; border-radius: 6px; border: 1px solid #bbf7d0; margin: 20px 0; color: #166534;">
            <strong>Success:</strong> Connection established, authenticated, and message dispatched successfully!
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px;">
            <tr>
              <td style="color: #64748b; padding: 4px 0;">SMTP Host:</td>
              <td style="font-weight: bold; text-align: right; padding: 4px 0;">{temp_val["host"]}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 4px 0;">SMTP Port:</td>
              <td style="font-weight: bold; text-align: right; padding: 4px 0;">{temp_val["port"]}</td>
            </tr>
            <tr>
              <td style="color: #64748b; padding: 4px 0;">Sender Email:</td>
              <td style="font-weight: bold; text-align: right; padding: 4px 0;">{temp_val["sender_email"]}</td>
            </tr>
          </table>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-bottom: 0;">Sent on {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}</p>
        </div>
        """
        
        # Override smtp configs inside standard helper function by passing it in SystemSetting mock
        db_setting = db.query(SystemSetting).filter(SystemSetting.key == "smtp_config_test_temp").first()
        if not db_setting:
            db_setting = SystemSetting(key="smtp_config_test_temp", value=temp_val)
            db.add(db_setting)
        else:
            db_setting.value = temp_val
        db.commit()

        # Execute using temporary setting
        db_setting_live = db.query(SystemSetting).filter(SystemSetting.key == "smtp_config").first()
        backup_val = db_setting_live.value if db_setting_live else None
        
        try:
            if not db_setting_live:
                db_setting_live = SystemSetting(key="smtp_config", value=temp_val)
                db.add(db_setting_live)
            else:
                db_setting_live.value = temp_val
            db.commit()
            
            # Fire
            send_email(db, data.test_email, subject, body_html)
        finally:
            # Revert to backup state
            if backup_val is None:
                if db_setting_live: db.delete(db_setting_live)
            else:
                db_setting_live.value = backup_val
            
            # Delete temp config
            db.delete(db_setting)
            db.commit()

        return {"message": f"Test email successfully dispatched to {data.test_email}"}
    except Exception as e:
        raise HTTPException(400, f"SMTP Connection Failed: {str(e)}")


@router.get("/templates")
def list_email_templates(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Get all editable email templates."""
    return db.query(EmailTemplate).order_by(EmailTemplate.name).all()


@router.post("/templates")
def update_email_template(data: TemplateUpdateSchema, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Update rich subject and HTML template body."""
    tpl = db.query(EmailTemplate).filter(EmailTemplate.name == data.name).first()
    if not tpl:
        raise HTTPException(404, f"Email Template '{data.name}' not found")
        
    tpl.subject = data.subject
    tpl.body_html = data.body_html
    tpl.updated_at = datetime.utcnow()
    db.commit()
    return {"message": f"Template '{data.name}' updated successfully"}


# ── DATABASE SEEDERS ─────────────────────────────────────────────────────────
def seed_email_templates(db: Session):
    """Seed default email templates for Payroll & Approvals if missing."""
    defaults = [
        {
            "name": "payslip_notification",
            "subject": "Your Payslip for {month} {year}",
            "placeholders": ["employee_name", "month", "year", "net_salary"],
            "body_html": """<div style="background-color: #EEF2F7; padding: 40px 20px; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, Arial, sans-serif; min-height: 100%;">
  <div style="width: 100%; max-width: 875px; min-height: 495px; background-color: #ffffff; border: 1px solid #cbd5e0; border-radius: 16px; padding: 40px; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.04); box-sizing: border-box; margin: 0 auto; display: flex; flex-direction: column; justify-content: space-between;">
    <div>
      <h2 style="color: #195402; margin-top: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;">💵 Salary Payslip Issued</h2>
      <p style="color: #2d3748; font-size: 15px; margin-top: 16px;">Dear <strong style="color: #0d1117;">{employee_name}</strong>,</p>
      <p style="color: #2d3748; font-size: 14px; line-height: 1.6;">We are pleased to inform you that your salary payslip for <strong style="color: #0d1117;">{month} {year}</strong> has been generated and issued.</p>
      <div style="background-color: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0; margin: 24px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="color: #718096; font-size: 13.5px; padding: 12px 0; width: 50%; font-weight: 500;">Month/Year:</td>
            <td style="font-weight: 700; text-align: right; color: #0d1117; padding: 12px 0; font-size: 14.5px;">{month} {year}</td>
          </tr>
          <tr>
            <td style="color: #718096; font-size: 13.5px; padding: 12px 0; font-weight: 500;">Net Payable:</td>
            <td style="font-weight: 700; text-align: right; color: #195402; font-size: 18px; padding: 12px 0;">₹{net_salary}</td>
          </tr>
        </table>
      </div>
      <p style="color: #2d3748; font-size: 14px;">Please find your detailed payslip PDF attached to this email.</p>
    </div>
    <div>
      <hr style="border: 0; border-top: 1px solid #cbd5e0; margin: 24px 0;" />
      <p style="font-size: 11px; color: #a0aec0; text-align: center; margin-bottom: 0;">This email was automatically generated by KIM ERP. Please do not reply directly to this mail.</p>
    </div>
  </div>
</div>"""
        },
        {
            "name": "leave_status_update",
            "subject": "Leave Request Update: {status}",
            "placeholders": ["employee_name", "leave_type", "from_date", "to_date", "status", "approver_name", "reason"],
            "body_html": """<div style="background-color: #EEF2F7; padding: 40px 20px; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, Arial, sans-serif; min-height: 100%;">
  <div style="width: 100%; max-width: 875px; min-height: 495px; background-color: #ffffff; border: 1px solid #cbd5e0; border-radius: 16px; padding: 40px; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.04); box-sizing: border-box; margin: 0 auto; display: flex; flex-direction: column; justify-content: space-between;">
    <div>
      <h2 style="color: #195402; margin-top: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;">🔄 Leave Request Status Update</h2>
      <p style="color: #2d3748; font-size: 15px; margin-top: 16px;">Dear <strong style="color: #0d1117;">{employee_name}</strong>,</p>
      <p style="color: #2d3748; font-size: 14px; line-height: 1.6;">Your leave request has been <strong style="color: #0d1117;">{status}</strong> by <strong style="color: #0d1117;">{approver_name}</strong>.</p>
      <div style="background-color: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0; margin: 24px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="color: #718096; font-size: 13.5px; padding: 12px 0; width: 40%; font-weight: 500;">Leave Type:</td>
            <td style="font-weight: 700; color: #0d1117; padding: 12px 0; text-align: right; font-size: 14.5px;">{leave_type}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="color: #718096; font-size: 13.5px; padding: 12px 0; padding-top: 12px; font-weight: 500;">Duration:</td>
            <td style="font-weight: 700; color: #0d1117; padding: 12px 0; text-align: right; font-size: 14.5px;">{from_date} to {to_date}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="color: #718096; font-size: 13.5px; padding: 12px 0; font-weight: 500;">Status:</td>
            <td style="font-weight: 700; color: #195402; padding: 12px 0; text-transform: uppercase; text-align: right; font-size: 14.5px;">{status}</td>
          </tr>
          <tr>
            <td style="color: #718096; font-size: 13.5px; padding: 12px 0; font-weight: 500;">Remarks:</td>
            <td style="font-weight: 700; color: #ea580c; padding: 12px 0; text-align: right; font-size: 14.5px;">{reason}</td>
          </tr>
        </table>
      </div>
    </div>
    <div>
      <hr style="border: 0; border-top: 1px solid #cbd5e0; margin: 24px 0;" />
      <p style="font-size: 11px; color: #a0aec0; text-align: center; margin-bottom: 0;">This email was automatically generated by KIM ERP. Please do not reply directly to this mail.</p>
    </div>
  </div>
</div>"""
        },
        {
            "name": "onduty_status_update",
            "subject": "On-Duty Request Update: {status}",
            "placeholders": ["employee_name", "date", "status", "approver_name", "reason"],
            "body_html": """<div style="background-color: #EEF2F7; padding: 40px 20px; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, Arial, sans-serif; min-height: 100%;">
  <div style="width: 100%; max-width: 875px; min-height: 495px; background-color: #ffffff; border: 1px solid #cbd5e0; border-radius: 16px; padding: 40px; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.04); box-sizing: border-box; margin: 0 auto; display: flex; flex-direction: column; justify-content: space-between;">
    <div>
      <h2 style="color: #195402; margin-top: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;">🔄 On-Duty Request Status Update</h2>
      <p style="color: #2d3748; font-size: 15px; margin-top: 16px;">Dear <strong style="color: #0d1117;">{employee_name}</strong>,</p>
      <p style="color: #2d3748; font-size: 14px; line-height: 1.6;">Your On-Duty request has been <strong style="color: #0d1117;">{status}</strong> by <strong style="color: #0d1117;">{approver_name}</strong>.</p>
      <div style="background-color: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0; margin: 24px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="color: #718096; font-size: 13.5px; padding: 12px 0; width: 40%; font-weight: 500;">On-Duty Date:</td>
            <td style="font-weight: 700; color: #0d1117; padding: 12px 0; text-align: right; font-size: 14.5px;">{date}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="color: #718096; font-size: 13.5px; padding: 12px 0; font-weight: 500;">Status:</td>
            <td style="font-weight: 700; color: #195402; padding: 12px 0; text-transform: uppercase; text-align: right; font-size: 14.5px;">{status}</td>
          </tr>
          <tr>
            <td style="color: #718096; font-size: 13.5px; padding: 12px 0; font-weight: 500;">Remarks:</td>
            <td style="font-weight: 700; color: #ea580c; padding: 12px 0; text-align: right; font-size: 14.5px;">{reason}</td>
          </tr>
        </table>
      </div>
    </div>
    <div>
      <hr style="border: 0; border-top: 1px solid #cbd5e0; margin: 24px 0;" />
      <p style="font-size: 11px; color: #a0aec0; text-align: center; margin-bottom: 0;">This email was automatically generated by KIM ERP. Please do not reply directly to this mail.</p>
    </div>
  </div>
</div>"""
        },
        # ── Manager notification on Leave application ──
        {
            "name": "leave_new_request",
            "subject": "Action Required: Leave Request from {employee_name}",
            "placeholders": ["employee_name", "leave_type", "from_date", "to_date", "total_days", "reason", "approver_name", "action_url"],
            "body_html": """<div style="background-color: #EEF2F7; padding: 40px 20px; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, Arial, sans-serif; min-height: 100%;">
  <div style="width: 100%; max-width: 875px; min-height: 495px; background-color: #ffffff; border: 1px solid #cbd5e0; border-radius: 16px; padding: 40px; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.04); box-sizing: border-box; margin: 0 auto; display: flex; flex-direction: column; justify-content: space-between;">
    <div>
      <h2 style="color: #195402; margin-top: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;">📋 New Leave Request — Approval Required</h2>
      <p style="color: #2d3748; font-size: 15px; margin-top: 16px;">Dear <strong style="color: #0d1117;">{approver_name}</strong>,</p>
      <p style="color: #2d3748; font-size: 14px; line-height: 1.6;"><strong style="color: #0d1117;">{employee_name}</strong> has submitted a leave request that requires your approval.</p>
      <div style="background-color: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0; margin: 24px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="color: #718096; font-size: 13.5px; padding: 12px 0; width: 35%; font-weight: 500;">Employee:</td>
            <td style="font-weight: 700; color: #0d1117; padding: 12px 0; text-align: right; font-size: 14.5px;">{employee_name}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="color: #718096; font-size: 13.5px; padding: 12px 0; font-weight: 500;">Leave Type:</td>
            <td style="font-weight: 700; color: #0d1117; padding: 12px 0; text-align: right; font-size: 14.5px;">{leave_type}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="color: #718096; font-size: 13.5px; padding: 12px 0; font-weight: 500;">Duration:</td>
            <td style="font-weight: 700; color: #0d1117; padding: 12px 0; text-align: right; font-size: 14.5px;">{from_date} to {to_date} ({total_days} day(s))</td>
          </tr>
          <tr>
            <td style="color: #718096; font-size: 13.5px; padding: 12px 0; font-weight: 500;">Reason:</td>
            <td style="font-weight: 700; color: #0d1117; padding: 12px 0; text-align: right; font-size: 14.5px;">{reason}</td>
          </tr>
        </table>
      </div>
      <div style="text-align: center; margin: 32px 0 20px;">
        <a href="{action_url}" style="display: inline-block; background: linear-gradient(135deg, #238204 0%, #195402 100%); color: #ffffff; text-decoration: none; padding: 14px 44px; border-radius: 50px; font-weight: 700; font-size: 15px; letter-spacing: 0.3px; box-shadow: 0 6px 20px rgba(25, 84, 2, 0.25); border: 1px solid #195402;">Respond Now →</a>
      </div>
      <p style="font-size: 12px; color: #718096; text-align: center; margin-bottom: 24px;">Or copy this link:<br/><a href="{action_url}" style="color: #238204; text-decoration: underline; word-break: break-all; display: inline-block; margin-top: 6px;">{action_url}</a></p>
    </div>
    <div>
      <hr style="border: 0; border-top: 1px solid #cbd5e0; margin: 24px 0;" />
      <p style="font-size: 11px; color: #a0aec0; text-align: center; margin-bottom: 0;">This email was automatically generated by KIM ERP. Please do not reply directly to this mail.</p>
    </div>
  </div>
</div>"""
        },
        # ── CC Notification on Leave application ──
        {
            "name": "leave_cc_notice",
            "subject": "FYI: Leave Request from {employee_name}",
            "placeholders": ["employee_name", "leave_type", "from_date", "to_date", "total_days", "reason"],
            "body_html": """<div style="background-color: #EEF2F7; padding: 40px 20px; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, Arial, sans-serif; min-height: 100%;">
  <div style="width: 100%; max-width: 875px; background-color: #ffffff; border: 1px solid #cbd5e0; border-radius: 16px; padding: 40px; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.04); box-sizing: border-box; margin: 0 auto;">
    <div>
      <h2 style="color: #2563eb; margin-top: 0; font-size: 22px; font-weight: 700;">📌 Leave Information</h2>
      <p style="color: #2d3748; font-size: 14px; line-height: 1.6;"><strong style="color: #0d1117;">{employee_name}</strong> has submitted a leave request and tagged you in CC for informational purposes.</p>
      <div style="background-color: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0; margin: 24px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="color: #718096; font-size: 13.5px; padding: 12px 0; width: 35%; font-weight: 500;">Employee:</td>
            <td style="font-weight: 700; color: #0d1117; padding: 12px 0; text-align: right;">{employee_name}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="color: #718096; font-size: 13.5px; padding: 12px 0; font-weight: 500;">Leave Type:</td>
            <td style="font-weight: 700; color: #0d1117; padding: 12px 0; text-align: right;">{leave_type}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="color: #718096; font-size: 13.5px; padding: 12px 0; font-weight: 500;">Duration:</td>
            <td style="font-weight: 700; color: #0d1117; padding: 12px 0; text-align: right;">{from_date} to {to_date} ({total_days} day(s))</td>
          </tr>
          <tr>
            <td style="color: #718096; font-size: 13.5px; padding: 12px 0; font-weight: 500;">Reason:</td>
            <td style="font-weight: 700; color: #0d1117; padding: 12px 0; text-align: right;">{reason}</td>
          </tr>
        </table>
      </div>
      <p style="font-size: 12px; color: #718096;">Note: This email is for your information. Action/Approval is handled by the primary manager.</p>
    </div>
  </div>
</div>"""
        },
        # ── Manager notification on On-Duty application ──
        {
            "name": "onduty_new_request",
            "subject": "Action Required: On-Duty Request from {employee_name}",
            "placeholders": ["employee_name", "date", "from_time", "to_time", "work_location", "purpose", "approver_name", "action_url"],
            "body_html": """<div style="background-color: #EEF2F7; padding: 40px 20px; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, Arial, sans-serif; min-height: 100%;">
  <div style="width: 100%; max-width: 875px; min-height: 495px; background-color: #ffffff; border: 1px solid #cbd5e0; border-radius: 16px; padding: 40px; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.04); box-sizing: border-box; margin: 0 auto; display: flex; flex-direction: column; justify-content: space-between;">
    <div>
      <h2 style="color: #195402; margin-top: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;">💼 New On-Duty Request — Approval Required</h2>
      <p style="color: #2d3748; font-size: 15px; margin-top: 16px;">Dear <strong style="color: #0d1117;">{approver_name}</strong>,</p>
      <p style="color: #2d3748; font-size: 14px; line-height: 1.6;"><strong style="color: #0d1117;">{employee_name}</strong> has submitted an On-Duty request that requires your approval.</p>
      <div style="background-color: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0; margin: 24px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="color: #718096; font-size: 13.5px; padding: 12px 0; width: 35%; font-weight: 500;">Employee:</td>
            <td style="font-weight: 700; color: #0d1117; padding: 12px 0; text-align: right; font-size: 14.5px;">{employee_name}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="color: #718096; font-size: 13.5px; padding: 12px 0; font-weight: 500;">Date:</td>
            <td style="font-weight: 700; color: #0d1117; padding: 12px 0; text-align: right; font-size: 14.5px;">{date}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="color: #718096; font-size: 13.5px; padding: 12px 0; font-weight: 500;">Time:</td>
            <td style="font-weight: 700; color: #0d1117; padding: 12px 0; text-align: right; font-size: 14.5px;">{from_time} – {to_time}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="color: #718096; font-size: 13.5px; padding: 12px 0; font-weight: 500;">Location:</td>
            <td style="font-weight: 700; color: #0d1117; padding: 12px 0; text-align: right; font-size: 14.5px;">{work_location}</td>
          </tr>
          <tr>
            <td style="color: #718096; font-size: 13.5px; padding: 12px 0; font-weight: 500;">Purpose:</td>
            <td style="font-weight: 700; color: #0d1117; padding: 12px 0; text-align: right; font-size: 14.5px;">{purpose}</td>
          </tr>
        </table>
      </div>
      <div style="text-align: center; margin: 32px 0 20px;">
        <a href="{action_url}" style="display: inline-block; background: linear-gradient(135deg, #238204 0%, #195402 100%); color: #ffffff; text-decoration: none; padding: 14px 44px; border-radius: 50px; font-weight: 700; font-size: 15px; letter-spacing: 0.3px; box-shadow: 0 6px 20px rgba(25, 84, 2, 0.25); border: 1px solid #195402;">Respond Now →</a>
      </div>
      <p style="font-size: 12px; color: #718096; text-align: center; margin-bottom: 24px;">Or copy this link:<br/><a href="{action_url}" style="color: #238204; text-decoration: underline; word-break: break-all; display: inline-block; margin-top: 6px;">{action_url}</a></p>
    </div>
    <div>
      <hr style="border: 0; border-top: 1px solid #cbd5e0; margin: 24px 0;" />
      <p style="font-size: 11px; color: #a0aec0; text-align: center; margin-bottom: 0;">This email was automatically generated by KIM ERP. Please do not reply directly to this mail.</p>
    </div>
  </div>
</div>"""
        }
    ]

    for item in defaults:
        exists = db.query(EmailTemplate).filter(EmailTemplate.name == item["name"]).first()
        if not exists:
            tpl = EmailTemplate(
                name=item["name"],
                subject=item["subject"],
                body_html=item["body_html"],
                placeholders=item["placeholders"]
            )
            db.add(tpl)
        else:
            # Always update so template changes in code are applied on next restart
            exists.subject = item["subject"]
            exists.body_html = item["body_html"]
            exists.placeholders = item["placeholders"]
    db.commit()
