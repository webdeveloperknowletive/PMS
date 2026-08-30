"""
==========================================================
                USERS SERVICE
==========================================================

Business logic layer for Users. Orchestrates calls to
repository.py and translates "not found" / "duplicate"
into HTTP errors. Routers should only ever call this
layer, never the model or repository directly.
"""

from uuid import UUID

import bcrypt
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.users import repository
from app.modules.users.model import User
from app.modules.users.schema import UserCreate, UserUpdate


def _hash_password(plain_password: str) -> str:
    """Hash a user's password."""
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def get_users(db: Session, skip: int = 0, limit: int = 100) -> list[User]:
    """Get all users (paginated)."""
    return repository.get_users(db, skip=skip, limit=limit)


def get_user(db: Session, user_id: UUID) -> User:
    """Get a single user by ID, or raise 404."""
    user = repository.get_user(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def create_user(db: Session, payload: UserCreate) -> User:
    """
    Create a new user. Raises 409 (not a raw 500) if the email is
    already taken, enforced by the users.email UNIQUE constraint.
    """
    try:
        return repository.create_user(db, payload, password_hash=_hash_password(payload.password))
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A user with this email already exists")


def update_user(db: Session, user_id: UUID, payload: UserUpdate) -> User:
    """Update an existing user, or raise 404."""
    user = repository.update_user(db, user_id, payload)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def delete_user(db: Session, user_id: UUID) -> None:
    """Delete a user, or raise 404."""
    deleted = repository.delete_user(db, user_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")


def update_user_status(db: Session, user_id: UUID, is_active: bool) -> User:
    """Activate or deactivate a user, or raise 404."""
    user = repository.set_user_active_state(db, user_id, is_active)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def change_password(db: Session, user_id: UUID, new_password: str) -> User:
    """Change a user's password, or raise 404."""
    user = repository.update_user_password(db, user_id, password_hash=_hash_password(new_password))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def update_profile(db: Session, user_id: UUID, payload: UserUpdate) -> User:
    """Update a user's profile, or raise 404."""
    user = repository.update_user(db, user_id, payload)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user
