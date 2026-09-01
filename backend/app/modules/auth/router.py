"""
Auth has no model.py / schema.py of its own for request/response bodies —
authentication operates directly against the `User` model and reuses
UserCreate/UserRead from the users module, since registering is just
creating a user.

All password-hashing and JWT logic lives in app.modules.auth.service
(already used elsewhere — app.core.dependencies.get_current_user calls
service.decode_token). This router is now a thin HTTP wrapper around
that service, instead of re-implementing the same logic a second time.
"""

from fastapi import APIRouter, Body, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import EmailStr
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.modules.auth import service
from app.modules.users.model import User
from app.modules.users.schema import UserCreate, UserRead

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(
    payload: UserCreate,
    db: Session = Depends(get_db),
):
    return service.register(db, payload)


@router.post("/login", status_code=status.HTTP_200_OK)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    return service.login(db, form_data.username, form_data.password)


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    current_user: User = Depends(get_current_user),
):
    return service.logout()


@router.post("/refresh-token", status_code=status.HTTP_200_OK)
async def refresh_token(
    refresh_token: str = Body(..., embed=True),
    db: Session = Depends(get_db),
):
    return service.refresh_token(db, refresh_token)


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(
    email: EmailStr = Body(..., embed=True),
    db: Session = Depends(get_db),
):
    return service.forgot_password(db, email)


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(
    token: str = Body(..., embed=True),
    new_password: str = Body(..., embed=True, min_length=8),
    db: Session = Depends(get_db),
):
    return service.reset_password(db, token, new_password)


@router.post("/verify-email", status_code=status.HTTP_200_OK)
async def verify_email(
    token: str = Body(..., embed=True),
    db: Session = Depends(get_db),
):
    return service.verify_email(db, token)


@router.get("/me", response_model=UserRead, status_code=status.HTTP_200_OK)
async def get_current_user_route(
    current_user: User = Depends(get_current_user),
):
    return current_user
