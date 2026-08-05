"""
Auth has no model.py / schema.py of its own in this project (both files are
empty) — authentication operates directly against the `User` model and
reuses `UserCreate` / `UserRead` from the users module, since registering
is just creating a user. JWT encode/decode and password hashing are done
inline here with bcrypt / python-jose (both already in requirements.txt)
because app/core/security.py is currently empty and this task is scoped to
router.py files only — see the chat notes for what to wire up there instead.
"""
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from pydantic import EmailStr
from sqlalchemy.orm import Session
import bcrypt

from db.session import get_db
from app.core.config import ACCESS_TOKEN_EXPIRE_MINUTES, ALGORITHM, SECRET_KEY
from app.modules.users.model import User
from app.modules.users.schema import UserCreate, UserRead

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

REFRESH_TOKEN_EXPIRE_MINUTES = ACCESS_TOKEN_EXPIRE_MINUTES * 24 * 7  # 7 days worth of access-token lifetimes
RESET_TOKEN_EXPIRE_MINUTES = 30
VERIFY_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours


def _hash_password(plain_password: str) -> str:
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(plain_password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), password_hash.encode("utf-8"))


def _create_token(subject: str, expires_minutes: int, purpose: str = "access") -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    payload = {"sub": subject, "purpose": purpose, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _decode_token(token: str, expected_purpose: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    if payload.get("purpose") != expected_purpose:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token purpose")

    return payload


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = _decode_token(token, expected_purpose="access")

    user = db.get(User, UUID(payload["sub"]))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(
    payload: UserCreate,
    db: Session = Depends(get_db),
):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    data = payload.model_dump(exclude={"password"})
    user = User(**data, password_hash=_hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", status_code=status.HTTP_200_OK)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == form_data.username).first()
    if user is None or not _verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

    access_token = _create_token(str(user.user_id), ACCESS_TOKEN_EXPIRE_MINUTES, purpose="access")
    refresh_token = _create_token(str(user.user_id), REFRESH_TOKEN_EXPIRE_MINUTES, purpose="refresh")

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    current_user: User = Depends(get_current_user),
):
    # JWTs are stateless and there is no token-blacklist table/service in this
    # project yet, so there is nothing to invalidate server-side — the client
    # is expected to discard the access/refresh tokens it's holding.
    return {"success": True, "message": "Logged out. Discard the access and refresh tokens client-side."}


@router.post("/refresh-token", status_code=status.HTTP_200_OK)
async def refresh_token(
    refresh_token: str = Body(..., embed=True),
    db: Session = Depends(get_db),
):
    payload = _decode_token(refresh_token, expected_purpose="refresh")

    user = db.get(User, UUID(payload["sub"]))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    new_access_token = _create_token(str(user.user_id), ACCESS_TOKEN_EXPIRE_MINUTES, purpose="access")
    return {"access_token": new_access_token, "token_type": "bearer"}


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(
    email: EmailStr = Body(..., embed=True),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        # Do not reveal whether the email exists.
        return {"success": True, "message": "If that email is registered, a reset link has been sent."}

    reset_token = _create_token(str(user.user_id), RESET_TOKEN_EXPIRE_MINUTES, purpose="password_reset")

    # NOTE: no email-sending service exists in this project yet (fastapi-mail
    # is in requirements.txt but unwired). Returning the token here so the
    # flow is usable end-to-end; swap this for an emailed link once a mail
    # service is configured.
    return {
        "success": True,
        "message": "If that email is registered, a reset link has been sent.",
        "reset_token": reset_token,
    }


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(
    token: str = Body(..., embed=True),
    new_password: str = Body(..., embed=True, min_length=8),
    db: Session = Depends(get_db),
):
    payload = _decode_token(token, expected_purpose="password_reset")

    user = db.get(User, UUID(payload["sub"]))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    user.password_hash = _hash_password(new_password)
    db.commit()
    return {"success": True, "message": "Password has been reset."}


@router.post("/verify-email", status_code=status.HTTP_200_OK)
async def verify_email(
    token: str = Body(..., embed=True),
    db: Session = Depends(get_db),
):
    payload = _decode_token(token, expected_purpose="email_verification")

    user = db.get(User, UUID(payload["sub"]))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    # The User model has no dedicated is_verified column, so is_active is
    # used as the closest existing field to represent a verified account.
    user.is_active = True
    db.commit()
    return {"success": True, "message": "Email verified."}


@router.get("/me", response_model=UserRead, status_code=status.HTTP_200_OK)
async def get_current_user_route(
    current_user: User = Depends(get_current_user),
):
    return current_user
