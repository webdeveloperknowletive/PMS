from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4
from urllib.parse import urlsplit, parse_qs

import pytest
from fastapi import HTTPException
from app.core import config
from app.modules.auth import service
from app.modules.auth.model import EmailVerificationToken
from app.modules.users.model import User


def test_canonical_url_preserves_token_and_workspace(monkeypatch):
    monkeypatch.setattr(config, "PUBLIC_APP_URL", "https://pms.knowletive.in")
    url = urlsplit(config.verification_app_url("knowletive-services", "a+b/c=&"))
    assert url.netloc == "pms.knowletive.in"
    assert url.path == "/verify-email"
    assert parse_qs(url.query) == {"workspace_slug": ["knowletive-services"], "token": ["a+b/c=&"]}


def test_tokens_are_unique_even_in_same_second():
    assert service.create_token("user", 10, "email_verification")[0] != service.create_token("user", 10, "email_verification")[0]


@pytest.mark.parametrize("scenario", ["success", "reused", "replaced", "wrong_workspace", "expired_row", "invalid", "expired_jwt"])
def test_verification_updates_only_valid_account_atomically(scenario):
    user = SimpleNamespace(user_id=uuid4(), organization_id=uuid4(), is_active=False, is_email_verified=scenario == "reused")
    row = SimpleNamespace(is_used=scenario in ("reused", "replaced"), expires_at=datetime.now(timezone.utc) + timedelta(hours=-1 if scenario == "expired_row" else 1))
    db = MagicMock()
    db.info = {}
    def query(model):
        result = MagicMock()
        result.filter.return_value.with_for_update.return_value.one_or_none.return_value = user if model is User else row
        return result
    db.query.side_effect = query
    db.get.return_value = SimpleNamespace(slug="acme")
    token = service.create_token(str(user.user_id), -1 if scenario == "expired_jwt" else 10, "email_verification")[0]
    if scenario == "invalid":
        token = "invalid"
    if scenario in ("success", "reused"):
        result = service.verify_email(db, token, "acme")
        assert result["success"]
        if scenario == "success":
            assert user.is_email_verified and user.is_active and row.is_used
            db.commit.assert_called_once()
        else:
            db.commit.assert_not_called()
    else:
        with pytest.raises(HTTPException) as exc:
            service.verify_email(db, token, "other" if scenario == "wrong_workspace" else "acme")
        assert exc.value.status_code == (410 if scenario in ("expired_row", "expired_jwt") else 400)
        assert not user.is_email_verified
        db.commit.assert_not_called()


def test_verification_mail_escapes_names_and_link(monkeypatch):
    from app.core import email
    send = MagicMock(return_value=True)
    monkeypatch.setattr(email, "send_product_email", send)
    assert email.send_verification_email("test@example.com", "<script>", "https://pms.example.com/verify-email?token=a&workspace_slug=b")
    html = send.call_args.kwargs["html_body"]
    assert "<script>" not in html
    assert "&lt;script&gt;" in html
    assert "token=a&amp;workspace_slug=b" in html
    assert "24 hours" in html


def test_resend_cooldown_does_not_issue_or_send(monkeypatch):
    user = SimpleNamespace(user_id=uuid4(), organization_id=uuid4(), is_email_verified=False)
    db = MagicMock()
    db.info = {}
    db.query.return_value.filter.return_value.with_for_update.return_value.one_or_none.return_value = user
    db.query.return_value.filter.return_value.order_by.return_value.first.return_value = SimpleNamespace(created_at=datetime.now(timezone.utc))
    send = MagicMock()
    monkeypatch.setattr(service, "send_verification_email", send)
    service.resend_verification(db, "test@example.com")
    db.add.assert_not_called()
    send.assert_not_called()
    db.rollback.assert_called_once()
