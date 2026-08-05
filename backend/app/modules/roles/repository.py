"""
==========================================================
                ROLES REPOSITORY
==========================================================

Data-access layer for Role and UserRole.
"""

# ==========================================================
# Import Required Modules
# ==========================================================

from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.roles.model import Role, UserRole
from app.modules.roles.schema import RoleCreate, RoleUpdate, UserRoleCreate


# ==========================================================
# Role
# ==========================================================

def create_role(
    db: Session,
    payload: RoleCreate,
) -> Role:

    role = Role(**payload.model_dump())

    db.add(role)
    db.commit()
    db.refresh(role)

    return role


def get_role(
    db: Session,
    role_id: UUID,
) -> Role | None:

    return db.get(Role, role_id)


def get_role_by_name(
    db: Session,
    role_name: str,
) -> Role | None:

    return (
        db.query(Role)
        .filter(Role.role_name == role_name)
        .first()
    )


def get_roles(
    db: Session,
    skip: int = 0,
    limit: int = 100,
) -> list[Role]:

    return (
        db.query(Role)
        .offset(skip)
        .limit(limit)
        .all()
    )


def update_role(
    db: Session,
    role_id: UUID,
    payload: RoleUpdate,
) -> Role | None:

    role = db.get(Role, role_id)

    if role is None:
        return None

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(role, field, value)

    db.commit()
    db.refresh(role)

    return role


def delete_role(
    db: Session,
    role_id: UUID,
) -> bool:

    role = db.get(Role, role_id)

    if role is None:
        return False

    db.delete(role)
    db.commit()

    return True


# ==========================================================
# User Role
# ==========================================================

def create_user_role(
    db: Session,
    payload: UserRoleCreate,
) -> UserRole:

    user_role = UserRole(**payload.model_dump())

    db.add(user_role)
    db.commit()
    db.refresh(user_role)

    return user_role


def get_user_role(
    db: Session,
    user_role_id: UUID,
) -> UserRole | None:

    return db.get(UserRole, user_role_id)


def get_roles_by_user(
    db: Session,
    user_id: UUID,
) -> list[UserRole]:

    return (
        db.query(UserRole)
        .filter(UserRole.user_id == user_id)
        .all()
    )


def get_users_by_role(
    db: Session,
    role_id: UUID,
) -> list[UserRole]:

    return (
        db.query(UserRole)
        .filter(UserRole.role_id == role_id)
        .all()
    )


def get_user_role_assignment(
    db: Session,
    user_id: UUID,
    role_id: UUID,
) -> UserRole | None:

    return (
        db.query(UserRole)
        .filter(
            UserRole.user_id == user_id,
            UserRole.role_id == role_id,
        )
        .first()
    )


def delete_user_role(
    db: Session,
    user_role_id: UUID,
) -> bool:

    user_role = db.get(UserRole, user_role_id)

    if user_role is None:
        return False

    db.delete(user_role)
    db.commit()

    return True
