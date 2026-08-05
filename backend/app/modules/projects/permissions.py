"""
Permissions for the projects module.

Projects are the top-level container the whole app hangs off of, so
creating, updating, or deleting one is restricted to management roles.
Everyone authenticated may read project data.
"""

from fastapi import Depends
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenException
from app.core.permissions import MANAGEMENT_ROLES, user_has_any_role
from app.modules.users.model import User


def can_manage_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Admin / Project Manager only: create, update, or delete a project.
    """

    if not user_has_any_role(db, current_user, MANAGEMENT_ROLES):
        raise ForbiddenException(
            message=f"Requires one of the following roles: {', '.join(MANAGEMENT_ROLES)}"
        )

    return current_user


def can_view_projects(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Any authenticated user may read project data.
    """

    return current_user
