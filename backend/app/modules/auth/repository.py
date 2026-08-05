"""
==========================================================
                AUTH REPOSITORY
==========================================================

Data-access layer for RefreshToken, PasswordResetToken,
EmailVerificationToken and LoginHistory.
"""

# ==========================================================
# Import Required Modules
# ==========================================================

from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.auth.model import (
    EmailVerificationToken,
    LoginHistory,
    PasswordResetToken,
    RefreshToken,
)
from app.modules.auth.schema import (
    EmailVerificationTokenCreate,
    LoginHistoryCreate,
    LoginHistoryUpdate,
    PasswordResetTokenCreate,
    RefreshTokenCreate,
)


# ==========================================================
# Refresh Tokens
# ==========================================================

def create_refresh_token(
    db: Session,
    payload: RefreshTokenCreate,
) -> RefreshToken:

    refresh_token = RefreshToken(**payload.model_dump())

    db.add(refresh_token)
    db.commit()
    db.refresh(refresh_token)

    return refresh_token


def get_refresh_token(
    db: Session,
    refresh_token_id: UUID,
) -> RefreshToken | None:

    return db.get(RefreshToken, refresh_token_id)


def get_refresh_token_by_token(
    db: Session,
    token: str,
) -> RefreshToken | None:

    return (
        db.query(RefreshToken)
        .filter(RefreshToken.token == token)
        .first()
    )


def get_refresh_tokens_by_user(
    db: Session,
    user_id: UUID,
) -> list[RefreshToken]:

    return (
        db.query(RefreshToken)
        .filter(RefreshToken.user_id == user_id)
        .all()
    )


def revoke_refresh_token(
    db: Session,
    refresh_token_id: UUID,
) -> RefreshToken | None:

    refresh_token = db.get(RefreshToken, refresh_token_id)

    if refresh_token is None:
        return None

    refresh_token.is_revoked = True

    db.commit()
    db.refresh(refresh_token)

    return refresh_token


def revoke_all_refresh_tokens_for_user(
    db: Session,
    user_id: UUID,
) -> int:

    updated = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.user_id == user_id,
            RefreshToken.is_revoked.is_(False),
        )
        .update({"is_revoked": True})
    )

    db.commit()

    return updated


def delete_refresh_token(
    db: Session,
    refresh_token_id: UUID,
) -> bool:

    refresh_token = db.get(RefreshToken, refresh_token_id)

    if refresh_token is None:
        return False

    db.delete(refresh_token)
    db.commit()

    return True


# ==========================================================
# Password Reset Tokens
# ==========================================================

def create_password_reset_token(
    db: Session,
    payload: PasswordResetTokenCreate,
) -> PasswordResetToken:

    reset_token = PasswordResetToken(**payload.model_dump())

    db.add(reset_token)
    db.commit()
    db.refresh(reset_token)

    return reset_token


def get_password_reset_token(
    db: Session,
    password_reset_token_id: UUID,
) -> PasswordResetToken | None:

    return db.get(PasswordResetToken, password_reset_token_id)


def get_password_reset_token_by_token(
    db: Session,
    token: str,
) -> PasswordResetToken | None:

    return (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token == token)
        .first()
    )


def mark_password_reset_token_used(
    db: Session,
    password_reset_token_id: UUID,
) -> PasswordResetToken | None:

    reset_token = db.get(PasswordResetToken, password_reset_token_id)

    if reset_token is None:
        return None

    reset_token.is_used = True

    db.commit()
    db.refresh(reset_token)

    return reset_token


def delete_password_reset_token(
    db: Session,
    password_reset_token_id: UUID,
) -> bool:

    reset_token = db.get(PasswordResetToken, password_reset_token_id)

    if reset_token is None:
        return False

    db.delete(reset_token)
    db.commit()

    return True


# ==========================================================
# Email Verification Tokens
# ==========================================================

def create_email_verification_token(
    db: Session,
    payload: EmailVerificationTokenCreate,
) -> EmailVerificationToken:

    verification_token = EmailVerificationToken(**payload.model_dump())

    db.add(verification_token)
    db.commit()
    db.refresh(verification_token)

    return verification_token


def get_email_verification_token(
    db: Session,
    email_verification_token_id: UUID,
) -> EmailVerificationToken | None:

    return db.get(EmailVerificationToken, email_verification_token_id)


def get_email_verification_token_by_token(
    db: Session,
    token: str,
) -> EmailVerificationToken | None:

    return (
        db.query(EmailVerificationToken)
        .filter(EmailVerificationToken.token == token)
        .first()
    )


def mark_email_verification_token_used(
    db: Session,
    email_verification_token_id: UUID,
) -> EmailVerificationToken | None:

    verification_token = db.get(
        EmailVerificationToken,
        email_verification_token_id,
    )

    if verification_token is None:
        return None

    verification_token.is_used = True

    db.commit()
    db.refresh(verification_token)

    return verification_token


def delete_email_verification_token(
    db: Session,
    email_verification_token_id: UUID,
) -> bool:

    verification_token = db.get(
        EmailVerificationToken,
        email_verification_token_id,
    )

    if verification_token is None:
        return False

    db.delete(verification_token)
    db.commit()

    return True


# ==========================================================
# Login History
# ==========================================================

def create_login_history(
    db: Session,
    payload: LoginHistoryCreate,
) -> LoginHistory:

    login_history = LoginHistory(**payload.model_dump())

    db.add(login_history)
    db.commit()
    db.refresh(login_history)

    return login_history


def get_login_history_entry(
    db: Session,
    login_history_id: UUID,
) -> LoginHistory | None:

    return db.get(LoginHistory, login_history_id)


def get_login_history_by_user(
    db: Session,
    user_id: UUID,
    skip: int = 0,
    limit: int = 100,
) -> list[LoginHistory]:

    return (
        db.query(LoginHistory)
        .filter(LoginHistory.user_id == user_id)
        .order_by(LoginHistory.login_time.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def update_login_history(
    db: Session,
    login_history_id: UUID,
    payload: LoginHistoryUpdate,
) -> LoginHistory | None:

    login_history = db.get(LoginHistory, login_history_id)

    if login_history is None:
        return None

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(login_history, field, value)

    db.commit()
    db.refresh(login_history)

    return login_history


def record_logout(
    db: Session,
    login_history_id: UUID,
    logout_time: datetime,
) -> LoginHistory | None:

    login_history = db.get(LoginHistory, login_history_id)

    if login_history is None:
        return None

    login_history.logout_time = logout_time

    db.commit()
    db.refresh(login_history)

    return login_history
