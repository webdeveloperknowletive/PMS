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
from app.core.permissions import ROLE_ADMIN, is_admin
from app.modules.users.model import User


def can_manage_roles(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Admin-only: create/update/delete roles and assign/revoke them.
    """

    if not is_admin(db, current_user):
        raise ForbiddenException(
            message=f"Requires the '{ROLE_ADMIN}' role"
        )

    return current_user
