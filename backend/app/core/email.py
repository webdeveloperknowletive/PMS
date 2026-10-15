"""Small SMTP mailer for account verification and workspace invitations."""

import logging
import smtplib
from email.message import EmailMessage

from fastapi import HTTPException

from app.core.config import (
    APP_ENV,
    SMTP_FROM_EMAIL,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_USE_TLS,
    SMTP_USERNAME,
)

logger = logging.getLogger(__name__)


def send_product_email(to_email: str, subject: str, body: str) -> bool:
    """Send email when SMTP is configured; allow copyable links in local development."""
    if not SMTP_HOST or not SMTP_FROM_EMAIL:
        if APP_ENV == "production":
            raise HTTPException(status_code=503, detail="Email delivery is not configured. Contact the workspace administrator.")
        logger.warning("SMTP is not configured; product email to %s was not delivered.", to_email)
        return False

    message = EmailMessage()
    message["From"] = SMTP_FROM_EMAIL
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(body)
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as smtp:
            if SMTP_USE_TLS:
                smtp.starttls()
            if SMTP_USERNAME:
                smtp.login(SMTP_USERNAME, SMTP_PASSWORD)
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        logger.exception("Could not send product email to %s", to_email)
        raise HTTPException(status_code=503, detail="Email delivery failed. Check the mail settings and try again.") from exc
    return True
