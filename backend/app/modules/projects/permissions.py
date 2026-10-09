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
from app.core.permissions import require_permission
from app.modules.users.model import User


def can_manage_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Admin / Project Manager only: create, update, or delete a project.
    """

    return require_permission("projects.manage")(current_user, db)


def can_view_projects(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Any authenticated user may read project data.
    """

    return current_user
