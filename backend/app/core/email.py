"""Small SMTP mailer for account verification and workspace invitations."""

import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid
from html import escape

from fastapi import HTTPException

from app.core.config import (
    APP_ENV,
    SMTP_FROM_EMAIL,
    SMTP_FROM_NAME,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_USE_TLS,
    SMTP_USERNAME,
)

logger = logging.getLogger(__name__)


def send_product_email(to_email: str, subject: str, body: str, *, html_body: str | None = None) -> bool:
    """Send email when SMTP is configured; allow copyable links in local development."""
    if not SMTP_HOST or not SMTP_FROM_EMAIL:
        if APP_ENV == "production":
            raise HTTPException(status_code=503, detail="Email delivery is not configured. Contact the workspace administrator.")
        logger.warning("SMTP is not configured; product email to %s was not delivered.", to_email)
        return False

    message = EmailMessage()
    message["From"] = formataddr((SMTP_FROM_NAME, SMTP_FROM_EMAIL))
    message["To"] = to_email
    message["Subject"] = subject
    message["Date"] = formatdate(localtime=False)
    message["Message-ID"] = make_msgid(domain=SMTP_FROM_EMAIL.rsplit("@", 1)[-1])
    message.set_content(body)
    if html_body:
        message.add_alternative(html_body, subtype="html")
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as smtp:
            if SMTP_USE_TLS:
                smtp.starttls(context=ssl.create_default_context())
            if SMTP_USERNAME:
                smtp.login(SMTP_USERNAME, SMTP_PASSWORD)
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        logger.exception("Could not send product email to %s", to_email)
        raise HTTPException(status_code=503, detail="Email delivery failed. Check the mail settings and try again.") from exc
    return True


def send_workspace_invitation(
    to_email: str, organization_name: str, invitation_url: str, expires_hours: int,
    *, inviter_name: str | None = None,
) -> bool:
    """Send the private acceptance link only to the intended employee."""
    introduction = (
        f"{inviter_name} invited you to join {organization_name} on SprintIX."
        if inviter_name else f"Your invitation to join {organization_name} on SprintIX has been renewed."
    )
    expiry = f"This invitation can be used once and expires in {expires_hours} hours."
    renewal = " Any previous invitation email is no longer valid." if not inviter_name else ""
    body = (
        f"Hello,\n\n{introduction}\n\nAccept your invitation and set up your account:\n"
        f"{invitation_url}\n\n{expiry}{renewal}\n\n"
        "If you were not expecting this invitation, you can ignore this email.\n\nSprintIX"
    )
    html_body = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f5f9;font-family:Arial,sans-serif;color:#1e293b">
<div style="max-width:560px;margin:32px auto;padding:32px;background:#fff;border-radius:12px">
<p style="color:#6d28d9;font-size:22px;font-weight:bold">SprintIX</p>
<h1 style="font-size:24px">Join {escape(organization_name)}</h1>
<p>Hello,</p><p style="line-height:1.6">{escape(introduction)}</p>
<p>Accept your invitation to set up your account and access your workspace.</p>
<p style="margin:28px 0"><a href="{escape(invitation_url, quote=True)}" style="display:inline-block;padding:14px 24px;background:#6d28d9;color:#fff;text-decoration:none;border-radius:8px">Accept invitation</a></p>
<p style="font-size:14px;line-height:1.6">{escape(expiry + renewal)}</p>
<p style="font-size:13px;color:#64748b">If you were not expecting this invitation, you can ignore this email.</p>
<p style="font-size:12px;color:#64748b">Button not working? Open this address:<br><a href="{escape(invitation_url, quote=True)}" style="word-break:break-all">{escape(invitation_url)}</a></p>
</div></body></html>"""
    return send_product_email(to_email, f"Invitation to {organization_name} | SprintIX", body, html_body=html_body)
