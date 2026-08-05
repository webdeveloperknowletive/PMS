"""
==========================================================
                USERS REPOSITORY
==========================================================

Data-access layer for the User model.
"""

# ==========================================================
# Import Required Modules
# ==========================================================

from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.users.model import User
from app.modules.users.schema import UserCreate, UserUpdate


# ==========================================================
# Create
# ==========================================================

def create_user(
    db: Session,
    payload: UserCreate,
    password_hash: str,
) -> User:

    data = payload.model_dump(exclude={"password"})

    user = User(
        **data,
        password_hash=password_hash,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


# ==========================================================
# Read
# ==========================================================

def get_user(
    db: Session,
    user_id: UUID,
) -> User | None:

    return db.get(User, user_id)


def get_user_by_email(
    db: Session,
    email: str,
) -> User | None:

    return (
        db.query(User)
        .filter(User.email == email)
        .first()
    )


def get_users(
    db: Session,
    skip: int = 0,
    limit: int = 100,
) -> list[User]:

    return (
        db.query(User)
        .order_by(User.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_active_users(
    db: Session,
    skip: int = 0,
    limit: int = 100,
) -> list[User]:

    return (
        db.query(User)
        .filter(User.is_active.is_(True))
        .order_by(User.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def email_exists(
    db: Session,
    email: str,
) -> bool:

    return (
        db.query(User.user_id)
        .filter(User.email == email)
        .first()
        is not None
    )


def count_users(
    db: Session,
) -> int:

    return db.query(User).count()


# ==========================================================
# Update
# ==========================================================

def update_user(
    db: Session,
    user_id: UUID,
    payload: UserUpdate,
) -> User | None:

    user = db.get(User, user_id)

    if user is None:
        return None

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)

    return user


def update_user_password(
    db: Session,
    user_id: UUID,
    password_hash: str,
) -> User | None:

    user = db.get(User, user_id)

    if user is None:
        return None

    user.password_hash = password_hash

    db.commit()
    db.refresh(user)

    return user


def set_user_active_state(
    db: Session,
    user_id: UUID,
    is_active: bool,
) -> User | None:

    user = db.get(User, user_id)

    if user is None:
        return None

    user.is_active = is_active

    db.commit()
    db.refresh(user)

    return user


# ==========================================================
# Delete
# ==========================================================

def delete_user(
    db: Session,
    user_id: UUID,
) -> bool:

    user = db.get(User, user_id)

    if user is None:
        return False

    db.delete(user)
    db.commit()

    return True
