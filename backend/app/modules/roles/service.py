"""
==========================================================
                ROLES SERVICE
==========================================================

Business logic layer for Roles and Role Assignments.
Orchestrates calls to repository.py and translates
"not found" into HTTP errors. Routers should only ever
call this layer, never the model or repository directly.
"""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.roles import repository
from app.modules.roles.model import Role, UserRole
from app.modules.roles.schema import RoleCreate, RoleUpdate, UserRoleCreate


# ==========================================================
# Roles
# ==========================================================

def get_roles(
    db: Session,
    skip: int = 0,
    limit: int = 100,
) -> list[Role]:
    """Get all roles (paginated)."""
    return repository.get_roles(db, skip=skip, limit=limit)


def get_role(
    db: Session,
    role_id: UUID,
) -> Role:
    """Get a single role by ID, or raise 404."""
    role = repository.get_role(db, role_id)
    if role is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found",
        )
    return role


def create_role(
    db: Session,
    payload: RoleCreate,
) -> Role:
    """Create a new role."""
    return repository.create_role(db, payload)


def update_role(
    db: Session,
    role_id: UUID,
    payload: RoleUpdate,
) -> Role:
    """Update an existing role, or raise 404."""
    role = repository.update_role(db, role_id, payload)
    if role is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found",
        )
    return role


def delete_role(
    db: Session,
    role_id: UUID,
) -> None:
    """Delete a role, or raise 404."""
    deleted = repository.delete_role(db, role_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found",
        )


# ==========================================================
# User <-> Role Assignments
# ==========================================================

def get_user_roles(
    db: Session,
    user_id: UUID,
) -> list[UserRole]:
    """Get all roles assigned to a user."""
    return repository.get_roles_by_user(db, user_id)


def assign_role_to_user(
    db: Session,
    user_id: UUID,
    payload: UserRoleCreate,
) -> UserRole:
    """Assign a role to a user."""
    full_payload = UserRoleCreate(user_id=user_id, role_id=payload.role_id)
    return repository.create_user_role(db, full_payload)


def remove_role_from_user(
    db: Session,
    user_id: UUID,
    role_id: UUID,
) -> None:
    """Remove a role assignment from a user, or raise 404 if it doesn't exist."""
    assignment = repository.get_user_role_assignment(db, user_id, role_id)
    if assignment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role assignment not found",
        )
    repository.delete_user_role(db, assignment.user_role_id)
