"""
==========================================================
                AUTH SERVICE
==========================================================

Handles password hashing, JWT issuance/verification, and
the full auth flow (register/login/logout/refresh/reset/
verify).

Previously every token here was pure stateless JWT — issued,
never stored. That meant:
  - logout() did nothing but tell the client to discard its
    tokens; a stolen refresh token stayed valid until it
    naturally expired, with no way to revoke it.
  - a password-reset link could be reused as many times as
    someone had it, until it expired.
  - email-verification tokens had the same replay problem —
    and nothing even issued one, so verify_email() was
    previously unreachable through any real flow.

Now refresh, password-reset, and email-verification tokens
are each backed by a DB row (via repository.py) in addition
to being signed JWTs. The JWT signature+expiry check still
happens first (cheap, no DB hit for garbage tokens); the DB
row is the second check that makes revocation and single-use
enforcement actually possible.

Access tokens remain purely stateless — that's intentional;
they're short-lived and re-checking against a DB revocation
list on every request would defeat the point of using a JWT
for the access token in the first place.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID
from urllib.parse import quote
import hashlib

import bcrypt
from fastapi import HTTPException, status
from jose import JWTError, jwt
from pydantic import EmailStr
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.config import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    ALGORITHM,
    SECRET_KEY,
)
from app.core.config import APP_ENV, PUBLIC_APP_URL, workspace_app_url
from app.core.email import send_product_email
from app.modules.auth.model import EmailVerificationToken
from app.modules.platform.model import PlatformAdmin, PlatformAdminSession
from app.modules.auth import repository
from app.modules.organizations.model import Organization
from app.modules.auth.schema import (
    LoginHistoryCreate,
    PasswordResetTokenCreate,
    RefreshTokenCreate,
)
from app.modules.users.model import User
from app.modules.roles.model import Role, UserRole
from urllib.parse import quote

REFRESH_TOKEN_EXPIRE_MINUTES = ACCESS_TOKEN_EXPIRE_MINUTES * 24 * 7
RESET_TOKEN_EXPIRE_MINUTES = 30
VERIFY_TOKEN_EXPIRE_MINUTES = 60 * 24


# ---------------------------------------------------------------------
# Password Helpers
# ---------------------------------------------------------------------

def hash_password(plain_password: str) -> str:
    return bcrypt.hashpw(
        plain_password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")


def verify_password(
    plain_password: str,
    password_hash: str,
) -> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        password_hash.encode("utf-8"),
    )


# ---------------------------------------------------------------------
# JWT Helpers
# ---------------------------------------------------------------------

def create_token(
    subject: str,
    expires_minutes: int,
    purpose: str = "access",
) -> tuple[str, datetime]:
    """Returns (token, expires_at) so callers that need to persist the
    expiry (refresh/reset/verify tokens) use the exact same timestamp
    that's embedded in the JWT's own `exp` claim."""

    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)

    payload = {
        "sub": subject,
        "purpose": purpose,
        "exp": expire,
    }

    token = jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM,
    )

    return token, expire


def decode_token(
    token: str,
    expected_purpose: str,
):

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    if payload.get("purpose") != expected_purpose:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token purpose",
        )

    return payload


def resend_verification(db: Session, email: EmailStr) -> dict:
    user = db.query(User).filter(User.email == str(email).lower()).one_or_none()
    response = {"success": True, "message": "If that account needs verification, a new link has been sent.", "email_sent": False}
    if user is None or user.is_email_verified:
        return response

    db.info["organization_id"] = user.organization_id
    token, expiry = create_token(str(user.user_id), VERIFY_TOKEN_EXPIRE_MINUTES, "email_verification")
    db.query(EmailVerificationToken).filter(
        EmailVerificationToken.user_id == user.user_id,
        EmailVerificationToken.is_used.is_(False),
    ).update({EmailVerificationToken.is_used: True}, synchronize_session=False)
    db.add(EmailVerificationToken(user_id=user.user_id, token=token, expires_at=expiry))
    db.commit()
    workspace_slug = db.query(Organization.slug).filter(
        Organization.organization_id == user.organization_id
    ).scalar()
    verification_url = (
        workspace_app_url(workspace_slug, "/verify-email", {"token": token})
        if workspace_slug
        else f"{PUBLIC_APP_URL.rstrip('/')}/verify-email?token={quote(token)}"
    )
    try:
        response["email_sent"] = send_product_email(
            user.email,
            "Verify your SprintIX account",
            f"Hello {user.name},\n\nVerify your SprintIX account:\n{verification_url}\n\nThis link expires in 24 hours.",
        )
    except HTTPException:
        response["email_sent"] = False
    if not response["email_sent"] and APP_ENV != "production":
        response["verification_url"] = verification_url
    return response


# ---------------------------------------------------------------------
# Auth Services
# ---------------------------------------------------------------------

def login(
    db: Session,
    email: str,
    password: str,
    ip_address: str | None = None,
    user_agent: str | None = None,
    workspace_slug: str | None = None,
):

    # Platform accounts are intentionally isolated from customer workspaces.
    # Even if someone creates a customer user with the same email, the
    # developer-company account must use /platform/login exclusively.
    platform_admin = db.query(PlatformAdmin).filter(
        func.lower(PlatformAdmin.email) == str(email).strip().lower()
    ).first()
    if platform_admin is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Use the Platform Super Admin sign-in page.",
        )

    user = (
        db.query(User)
        .filter(func.lower(User.email) == str(email).lower())
        .first()
    )

    if (
        user is None
        or not verify_password(
            password,
            user.password_hash,
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )

    if not user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Verify your email before signing in.",
        )

    if workspace_slug:
        workspace_matches = db.query(Organization.organization_id).filter(
            Organization.organization_id == user.organization_id,
            Organization.slug == workspace_slug.strip().lower(),
        ).first()
        if workspace_matches is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password for this workspace.",
            )

    db.info["organization_id"] = user.organization_id

    access_token, _ = create_token(
        str(user.user_id),
        ACCESS_TOKEN_EXPIRE_MINUTES,
        "access",
    )

    refresh_token_str, refresh_expiry = create_token(
        str(user.user_id),
        REFRESH_TOKEN_EXPIRE_MINUTES,
        "refresh",
    )

    # Persist the refresh token so it can actually be revoked later
    # (on logout, or on password reset) — previously nothing stored it,
    # so revocation was impossible no matter what logout() claimed to do.
    repository.create_refresh_token(
        db,
        RefreshTokenCreate(
            user_id=user.user_id,
            token=refresh_token_str,
            expires_at=refresh_expiry,
            is_revoked=False,
        ),
    )

    repository.create_login_history(
        db,
        LoginHistoryCreate(
            user_id=user.user_id,
            ip_address=ip_address,
            user_agent=user_agent,
            is_successful=True,
        ),
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token_str,
        "token_type": "bearer",
    }


def platform_login(db: Session, email: str, password: str, ip_address: str | None = None, user_agent: str | None = None):
    admin = db.query(PlatformAdmin).filter(func.lower(PlatformAdmin.email) == str(email).strip().lower()).first()
    if admin is None or not verify_password(password, admin.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    if not admin.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Platform account is inactive")
    access_token, _ = create_token(str(admin.platform_admin_id), ACCESS_TOKEN_EXPIRE_MINUTES, "platform_access")
    refresh_token_str, refresh_expiry = create_token(str(admin.platform_admin_id), REFRESH_TOKEN_EXPIRE_MINUTES, "platform_refresh")
    db.add(PlatformAdminSession(platform_admin_id=admin.platform_admin_id, refresh_token_hash=hashlib.sha256(refresh_token_str.encode()).hexdigest(), expires_at=refresh_expiry, ip_address=ip_address, user_agent=user_agent))
    admin.last_login_at = datetime.now(timezone.utc)
    db.commit()
    return {"access_token": access_token, "refresh_token": refresh_token_str, "token_type": "bearer"}


def platform_logout(db: Session, admin: PlatformAdmin):
    count = db.query(PlatformAdminSession).filter(PlatformAdminSession.platform_admin_id == admin.platform_admin_id, PlatformAdminSession.revoked_at.is_(None)).update({PlatformAdminSession.revoked_at: datetime.now(timezone.utc)}, synchronize_session=False)
    db.commit()
    return {"success": True, "message": f"Logged out. Revoked {count} platform session(s)."}


def logout(
    db: Session,
    current_user: User,
):
    """
    Revokes every active refresh token for this user, across all devices.

    NOTE: this is a deliberate simplification — /auth/logout currently
    only receives the access token (via Depends), not the specific
    refresh token being retired, so there's no way to revoke just one
    session. If per-device logout matters later, the endpoint needs to
    accept the refresh_token in its request body and this should call
    repository.revoke_refresh_token() on that one token instead of
    revoke_all_refresh_tokens_for_user().
    """
    revoked_count = repository.revoke_all_refresh_tokens_for_user(db, current_user.user_id)

    return {
        "success": True,
        "message": f"Logged out. Revoked {revoked_count} refresh token(s).",
    }


def refresh_token(
    db: Session,
    refresh_token: str,
):

    payload = decode_token(
        refresh_token,
        "refresh",
    )

    user = db.get(
        User,
        UUID(payload["sub"]),
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    db.info["organization_id"] = user.organization_id

    # The JWT signature/expiry check above only proves the token was
    # legitimately issued at some point — it says nothing about whether
    # it's since been revoked. This is the actual revocation check.
    stored = repository.get_refresh_token_by_token(db, refresh_token)
    if stored is None or stored.is_revoked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked",
        )

    new_access_token, _ = create_token(
        str(user.user_id),
        ACCESS_TOKEN_EXPIRE_MINUTES,
        "access",
    )

    return {
        "access_token": new_access_token,
        "token_type": "bearer",
    }


def forgot_password(
    db: Session,
    email: EmailStr,
):

    user = (
        db.query(User)
        .filter(func.lower(User.email) == str(email).lower())
        .first()
    )

    if user is None:
        # Deliberately the same response whether or not the email exists,
        # so this endpoint can't be used to enumerate registered accounts.
        return {
            "success": True,
            "message": "If that email is registered, a reset link has been sent.",
        }

    db.info["organization_id"] = user.organization_id

    reset_token_str, reset_expiry = create_token(
        str(user.user_id),
        RESET_TOKEN_EXPIRE_MINUTES,
        "password_reset",
    )

    repository.create_password_reset_token(
        db,
        PasswordResetTokenCreate(
            user_id=user.user_id,
            token=reset_token_str,
            expires_at=reset_expiry,
            is_used=False,
        ),
    )

    reset_url = f"{PUBLIC_APP_URL.rstrip('/')}/reset-password?token={quote(reset_token_str)}"
    email_sent = False
    try:
        email_sent = send_product_email(
            user.email,
            "Reset your SprintIX password",
            f"Hello {user.name},\n\nUse this link to set a new password:\n{reset_url}\n\nThis link expires in 30 minutes and works once.",
        )
    except HTTPException:
        email_sent = False

    response = {
        "success": True,
        "message": "If that email is registered, a reset link has been sent.",
    }
    if not email_sent and APP_ENV != "production":
        response["reset_token"] = reset_token_str
    return response


def reset_password(
    db: Session,
    token: str,
    new_password: str,
):

    payload = decode_token(
        token,
        "password_reset",
    )

    user = db.get(
        User,
        UUID(payload["sub"]),
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    db.info["organization_id"] = user.organization_id

    # This is the actual single-use enforcement — the JWT itself would
    # happily decode again after being used once, since it has no
    # concept of "already redeemed". The DB row is what makes reset
    # links genuinely single-use instead of valid-until-expiry.
    stored = repository.get_password_reset_token_by_token(db, token)
    if stored is None or stored.is_used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This reset link has already been used or is invalid",
        )

    user.password_hash = hash_password(
        new_password
    )

    db.commit()

    repository.mark_password_reset_token_used(db, stored.password_reset_token_id)

    # Changing the password is a good moment to also kill any refresh
    # tokens issued before the change — otherwise a session started
    # before the reset (e.g. by whoever the reset was protecting
    # against) would stay valid regardless of the new password.
    repository.revoke_all_refresh_tokens_for_user(db, user.user_id)

    return {
        "success": True,
        "message": "Password has been reset.",
    }


def verify_email(
    db: Session,
    token: str,
):

    payload = decode_token(
        token,
        "email_verification",
    )

    user = db.get(
        User,
        UUID(payload["sub"]),
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    db.info["organization_id"] = user.organization_id

    stored = repository.get_email_verification_token_by_token(db, token)
    if stored is None or stored.is_used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification link has already been used or is invalid",
        )

    user.is_active = True
    user.is_email_verified = True
    db.commit()

    repository.mark_email_verification_token_used(db, stored.email_verification_token_id)

    return {
        "success": True,
        "message": "Email verified.",
    }


def get_current_user(
    db: Session,
    token: str,
):

    payload = decode_token(
        token,
        "access",
    )

    user = db.get(
        User,
        UUID(payload["sub"]),
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    db.info["organization_id"] = user.organization_id

    return user
