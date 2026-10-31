from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.core import email as mailer
from app.modules.organizations.schema import WorkspaceInviteRead


@pytest.fixture
def smtp(monkeypatch):
    monkeypatch.setattr(mailer, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(mailer, "SMTP_FROM_EMAIL", "invites@example.com")
    monkeypatch.setattr(mailer, "SMTP_FROM_NAME", "SprintIX")
    monkeypatch.setattr(mailer, "SMTP_USERNAME", "smtp-login")
    monkeypatch.setattr(mailer, "SMTP_PASSWORD", "test-key")
    monkeypatch.setattr(mailer, "SMTP_USE_TLS", True)
    factory = MagicMock()
    monkeypatch.setattr(mailer.smtplib, "SMTP", factory)
    return factory.return_value.__enter__.return_value


def test_invitation_sends_multipart_email_to_only_the_employee(smtp):
    url = "https://app.example.com/accept-invitation?token=private&workspace_slug=bmw"
    assert mailer.send_workspace_invitation("employee@example.com", "BMW", url, 72, inviter_name="Owner")
    message = smtp.send_message.call_args.args[0]
    assert message["To"] == "employee@example.com"
    assert message["From"] == "SprintIX <invites@example.com>"
    assert message["Date"] and message["Message-ID"]
    assert message.get_content_type() == "multipart/alternative"
    assert url in message.get_body(preferencelist=("plain",)).get_content()
    html = message.get_body(preferencelist=("html",)).get_content()
    assert "Accept invitation" in html
    assert "token=private&amp;workspace_slug=bmw" in html
    smtp.login.assert_called_once_with("smtp-login", "test-key")
    assert smtp.starttls.call_args.kwargs["context"].check_hostname


def test_invitation_escapes_workspace_and_inviter_names(smtp):
    mailer.send_workspace_invitation("employee@example.com", "<script>alert(1)</script>", "https://app.example.com/invite", 72, inviter_name="<b>Owner</b>")
    html = smtp.send_message.call_args.args[0].get_body(preferencelist=("html",)).get_content()
    assert "<script>" not in html and "<b>Owner</b>" not in html
    assert "&lt;script&gt;" in html and "&lt;b&gt;Owner&lt;/b&gt;" in html


def test_resend_email_explains_old_invitation_is_invalid(smtp):
    mailer.send_workspace_invitation("employee@example.com", "BMW", "https://app.example.com/invite", 72)
    body = smtp.send_message.call_args.args[0].get_body(preferencelist=("plain",)).get_content()
    assert "renewed" in body and "previous invitation email is no longer valid" in body


def test_smtp_failure_is_not_reported_as_success(smtp):
    smtp.login.side_effect = mailer.smtplib.SMTPAuthenticationError(535, b"Authentication failed")
    with pytest.raises(HTTPException) as exc:
        mailer.send_workspace_invitation("employee@example.com", "BMW", "https://app.example.com/invite", 72)
    assert exc.value.status_code == 503
    smtp.send_message.assert_not_called()


def test_invitation_response_never_exposes_the_acceptance_url():
    assert "invitation_url" not in WorkspaceInviteRead.model_fields
