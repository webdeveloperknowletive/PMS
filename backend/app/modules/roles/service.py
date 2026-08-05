from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.roles.model import (
    Role,
    UserRole,
)
from app.modules.roles.schema import (
    RoleCreate,
    RoleUpdate,
    UserRoleCreate,
)


# ==========================================================
# Roles
# ==========================================================

def get_roles(
    db: Session,
    skip: int = 0,
    limit: int = 100,
):
    """
    Get all roles.
    """
    return (
        db.query(Role)
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_role(
    db: Session,
    role_id: UUID,
):
    """
    Get role by ID.
    """
    role = db.get(
        Role,
        role_id,
    )

    if role is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found",
        )

    return role


def create_role(
    db: Session,
    payload: RoleCreate,
):
    """
    Create a new role.
    """
    role = Role(
        **payload.model_dump()
    )

    db.add(role)
    db.commit()
    db.refresh(role)

    return role


def update_role(
    db: Session,
    role_id: UUID,
    payload: RoleUpdate,
):
    """
    Update an existing role.
    """
    role = db.get(
        Role,
        role_id,
    )

    if role is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found",
        )

    for field, value in payload.model_dump(
        exclude_unset=True
    ).items():
        setattr(
            role,
            field,
            value,
        )

    db.commit()
    db.refresh(role)

    return role


def delete_role(
    db: Session,
    role_id: UUID,
):
    """
    Delete a role.
    """
    role = db.get(
        Role,
        role_id,
    )

    if role is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found",
        )

    db.delete(role)
    db.commit()

    return None


# ==========================================================
# User <-> Role Assignments
# ==========================================================

def get_user_roles(
    db: Session,
    user_id: UUID,
):
    """
    Get all roles assigned to a user.
    """
    return (
        db.query(UserRole)
        .filter(UserRole.user_id == user_id)
        .all()
    )


def assign_role_to_user(
    db: Session,
    user_id: UUID,
    payload: UserRoleCreate,
):
    """
    Assign a role to a user.
    """
    user_role = UserRole(
        **{
            **payload.model_dump(),
            "user_id": user_id,
        }
    )

    db.add(user_role)
    db.commit()
    db.refresh(user_role)

    return user_role


def remove_role_from_user(
    db: Session,
    user_id: UUID,
    role_id: UUID,
):
    """
    Remove a role assignment from a user.
    """
    user_role = (
        db.query(UserRole)
        .filter(
            UserRole.user_id == user_id,
            UserRole.role_id == role_id,
        )
        .first()
    )

    if user_role is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role assignment not found",
        )

    db.delete(user_role)
    db.commit()

    return None