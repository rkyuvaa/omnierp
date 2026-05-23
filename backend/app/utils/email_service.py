import smtplib
import os
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from sqlalchemy.orm import Session
from app.models import SystemSetting, EmailTemplate

logger = logging.getLogger(__name__)

def get_smtp_config(db: Session) -> dict:
    """
    Retrieve SMTP configurations.
    Priority: Database (system_settings table, key="smtp_config") -> Environment variables
    """
    config = {
        "host": "localhost",
        "port": 587,
        "username": "",
        "password": "",
        "sender_email": "No-Reply@domain.com",
        "sender_name": "KIM ERP",
        "use_tls": True,
        "use_ssl": False
    }

    try:
        db_setting = db.query(SystemSetting).filter(SystemSetting.key == "smtp_config").first()
        if db_setting and isinstance(db_setting.value, dict):
            val = db_setting.value
            config["host"] = val.get("host") or config["host"]
            config["port"] = int(val.get("port") or config["port"])
            config["username"] = val.get("username") or config["username"]
            config["password"] = val.get("password") or config["password"]
            config["sender_email"] = val.get("sender_email") or config["sender_email"]
            config["sender_name"] = val.get("sender_name") or config["sender_name"]
            config["use_tls"] = val.get("use_tls", True)
            config["use_ssl"] = val.get("use_ssl", False)
            return config
    except Exception as e:
        logger.error(f"Error fetching SMTP config from DB: {str(e)}")

    # Fallback to Environment Variables
    config["host"] = os.getenv("SMTP_HOST") or config["host"]
    config["port"] = int(os.getenv("SMTP_PORT") or config["port"])
    config["username"] = os.getenv("SMTP_USER") or config["username"]
    config["password"] = os.getenv("SMTP_PASSWORD") or config["password"]
    config["sender_email"] = os.getenv("SMTP_SENDER_EMAIL") or config["sender_email"]
    config["sender_name"] = os.getenv("SMTP_SENDER_NAME") or config["sender_name"]
    config["use_tls"] = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
    config["use_ssl"] = os.getenv("SMTP_USE_SSL", "false").lower() == "true"

    return config


def send_email(
    db: Session,
    to_email: str,
    subject: str,
    body_html: str,
    attachment_bytes: bytes = None,
    attachment_filename: str = None
):
    """
    Send an email with optional attachment using SMTP configurations.
    """
    if not to_email or "@" not in to_email:
        logger.error(f"Invalid recipient email address: {to_email}")
        raise ValueError("Invalid recipient email address")

    config = get_smtp_config(db)
    
    # Construct MIME message
    msg = MIMEMultipart("alternative" if not attachment_bytes else "mixed")
    msg["Subject"] = subject
    msg["From"] = f'"{config["sender_name"]}" <{config["sender_email"]}>'
    msg["To"] = to_email

    # Rich HTML body
    part_html = MIMEText(body_html, "html", "utf-8")
    
    if attachment_bytes:
        # Attach HTML body first
        body_part = MIMEMultipart("alternative")
        body_part.attach(part_html)
        msg.attach(body_part)
        
        # Attach binary file
        part_file = MIMEBase("application", "octet-stream")
        part_file.set_payload(attachment_bytes)
        encoders.encode_base64(part_file)
        part_file.add_header(
            "Content-Disposition",
            f'attachment; filename="{attachment_filename or "document.pdf"}"'
        )
        msg.attach(part_file)
    else:
        msg.attach(part_html)

    # Establish SMTP connection
    try:
        if config["use_ssl"]:
            server = smtplib.SMTP_SSL(config["host"], config["port"], timeout=15)
        else:
            server = smtplib.SMTP(config["host"], config["port"], timeout=15)
            if config["use_tls"]:
                server.starttls()
        
        # Authenticate if credentials are provided
        if config["username"] and config["password"]:
            server.login(config["username"], config["password"])
            
        server.sendmail(config["sender_email"], [to_email], msg.as_string())
        server.quit()
        logger.info(f"Email successfully sent to {to_email}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        raise Exception(f"SMTP Error: {str(e)}")


def send_template_email(
    db: Session,
    to_email: str,
    template_name: str,
    variables: dict,
    attachment_bytes: bytes = None,
    attachment_filename: str = None
):
    """
    Fetch an email template from the database, interpolate it with variables, and dispatch.
    """
    template = db.query(EmailTemplate).filter(EmailTemplate.name == template_name).first()
    if not template:
        raise ValueError(f"Email template '{template_name}' not found in the database")

    # Safe placeholder replacement using format dictionary
    try:
        # Interpolate variables safely
        subject = template.subject.format(**variables)
        body_html = template.body_html.format(**variables)
    except KeyError as ke:
        logger.warning(f"Template placeholder mismatch for key: {str(ke)}. Falling back to simple replacement.")
        # Fallback string replace just in case of formatting key errors
        subject = template.subject
        body_html = template.body_html
        for k, v in variables.items():
            subject = subject.replace(f"{{{k}}}", str(v))
            body_html = body_html.replace(f"{{{k}}}", str(v))

    return send_email(
        db=db,
        to_email=to_email,
        subject=subject,
        body_html=body_html,
        attachment_bytes=attachment_bytes,
        attachment_filename=attachment_filename
    )
