"""
==========================================================
                CORE SECURITY
==========================================================

Password hashing and JWT helpers shared across the app.

`app.modules.auth.service` currently implements these same primitives
inline (hash_password/verify_password/create_token/decode_token) using
the same libraries (bcrypt, python-jose) and the same app.core.config
settings. This module gives every other module (e.g. scripts/create_superuser.py,
future modules that need to mint or verify a token) a single place to
import them from, without reaching into app.modules.auth directly.

Function names and signatures intentionally match app.modules.auth.service
so that module could import from here instead of its inline copies
without any call-site changes.
"""

from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import HTTPException, status
from jose import JWTError, jwt

from app.core.config import ACCESS_TOKEN_EXPIRE_MINUTES, ALGORITHM, SECRET_KEY

# ==========================================================
# Password Hashing
# ==========================================================


def hash_password(plain_password: str) -> str:
    """
    Hash a plain-text password with bcrypt.
    """

    return bcrypt.hashpw(
        plain_password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")


def verify_password(
    plain_password: str,
    password_hash: str,
) -> bool:
    """
    Check a plain-text password against a bcrypt hash.
    """

    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        password_hash.encode("utf-8"),
    )


# ==========================================================
# JWT Helpers
# ==========================================================


def create_token(
    subject: str,
    expires_minutes: int,
    purpose: str = "access",
) -> str:
    """
    Encode a JWT for `subject`, expiring in `expires_minutes` minutes,
    tagged with `purpose` (checked on decode so an access token can't
    be reused as, say, a password_reset token).
    """

    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes
    )

    payload = {
        "sub": subject,
        "purpose": purpose,
        "exp": expire,
    }

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def create_access_token(subject: str) -> str:
    """
    Convenience wrapper: mint a standard access token using
    ACCESS_TOKEN_EXPIRE_MINUTES from app.core.config.
    """

    return create_token(
        subject,
        ACCESS_TOKEN_EXPIRE_MINUTES,
        "access",
    )


def decode_token(
    token: str,
    expected_purpose: str,
) -> dict:
    """
    Decode and validate a JWT, raising 401 if it is invalid, expired,
    or was issued for a different purpose than `expected_purpose`.
    """

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
