from datetime import datetime, timedelta, timezone
from uuid import UUID

import bcrypt
from fastapi import HTTPException, status
from jose import JWTError, jwt
from pydantic import EmailStr
from sqlalchemy.orm import Session

from app.core.config import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    ALGORITHM,
    SECRET_KEY,
)
from app.modules.users.model import User
from app.modules.users.schema import UserCreate

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
) -> str:

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


# ---------------------------------------------------------------------
# Auth Services
# ---------------------------------------------------------------------

def register(
    db: Session,
    payload: UserCreate,
):

    existing = (
        db.query(User)
        .filter(User.email == payload.email)
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    data = payload.model_dump(
        exclude={"password"}
    )

    user = User(
        **data,
        password_hash=hash_password(payload.password),
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


def login(
    db: Session,
    email: str,
    password: str,
):

    user = (
        db.query(User)
        .filter(User.email == email)
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

    access_token = create_token(
        str(user.user_id),
        ACCESS_TOKEN_EXPIRE_MINUTES,
        "access",
    )

    refresh_token = create_token(
        str(user.user_id),
        REFRESH_TOKEN_EXPIRE_MINUTES,
        "refresh",
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


def logout():

    return {
        "success": True,
        "message": "Logged out. Discard the access and refresh tokens client-side.",
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

    return {
        "access_token": create_token(
            str(user.user_id),
            ACCESS_TOKEN_EXPIRE_MINUTES,
            "access",
        ),
        "token_type": "bearer",
    }


def forgot_password(
    db: Session,
    email: EmailStr,
):

    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if user is None:
        return {
            "success": True,
            "message": "If that email is registered, a reset link has been sent.",
        }

    return {
        "success": True,
        "message": "If that email is registered, a reset link has been sent.",
        "reset_token": create_token(
            str(user.user_id),
            RESET_TOKEN_EXPIRE_MINUTES,
            "password_reset",
        ),
    }


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

    user.password_hash = hash_password(
        new_password
    )

    db.commit()

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

    user.is_active = True
    db.commit()

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

    return user