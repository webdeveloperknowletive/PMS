"""
Permissions for the roles module.

Role and user-role-assignment management is Admin-only: any user who
could grant themselves or others a role must already hold the
strongest one.
"""

from fastapi import Depends
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenException
from app.core.permissions import has_permission
from app.modules.users.model import User


def can_manage_roles(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Admin-only: create/update/delete roles and assign/revoke them.
    """

    if not has_permission(db, current_user, "roles.manage"):
        raise ForbiddenException(
            message="Missing required permission: roles.manage"
        )

    return current_user
