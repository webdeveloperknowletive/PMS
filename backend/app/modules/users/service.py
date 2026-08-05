from uuid import UUID

import bcrypt
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.users.model import User
from app.modules.users.schema import (
    UserCreate,
    UserUpdate,
)


def _hash_password(
    plain_password: str,
) -> str:
    """
    Hash a user's password.
    """
    return bcrypt.hashpw(
        plain_password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")


# ==========================================================
# Users
# ==========================================================

def get_users(
    db: Session,
    skip: int = 0,
    limit: int = 100,
):
    """
    Get all users.
    """
    return (
        db.query(User)
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_user(
    db: Session,
    user_id: UUID,
):
    """
    Get user by ID.
    """
    user = db.get(
        User,
        user_id,
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return user


def create_user(
    db: Session,
    payload: UserCreate,
):
    """
    Create a new user.
    """
    data = payload.model_dump(
        exclude={"password"},
    )

    user = User(
        **data,
        password_hash=_hash_password(
            payload.password,
        ),
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


def update_user(
    db: Session,
    user_id: UUID,
    payload: UserUpdate,
):
    """
    Update a user.
    """
    user = db.get(
        User,
        user_id,
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    for field, value in payload.model_dump(
        exclude_unset=True,
    ).items():
        setattr(
            user,
            field,
            value,
        )

    db.commit()
    db.refresh(user)

    return user


def delete_user(
    db: Session,
    user_id: UUID,
):
    """
    Delete a user.
    """
    user = db.get(
        User,
        user_id,
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    db.delete(user)
    db.commit()

    return None


# ==========================================================
# User Status
# ==========================================================

def update_user_status(
    db: Session,
    user_id: UUID,
    is_active: bool,
):
    """
    Activate or deactivate a user.
    """
    user = db.get(
        User,
        user_id,
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user.is_active = is_active

    db.commit()
    db.refresh(user)

    return user


# ==========================================================
# Password
# ==========================================================

def change_password(
    db: Session,
    user_id: UUID,
    new_password: str,
):
    """
    Change user password.
    """
    user = db.get(
        User,
        user_id,
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user.password_hash = _hash_password(
        new_password,
    )

    db.commit()
    db.refresh(user)

    return user


# ==========================================================
# Profile
# ==========================================================

def update_profile(
    db: Session,
    user_id: UUID,
    payload: UserUpdate,
):
    """
    Update user profile.
    """
    user = db.get(
        User,
        user_id,
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    for field, value in payload.model_dump(
        exclude_unset=True,
    ).items():
        setattr(
            user,
            field,
            value,
        )

    db.commit()
    db.refresh(user)

    return user