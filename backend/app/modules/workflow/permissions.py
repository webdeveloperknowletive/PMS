"""
Permissions for the workflow module.

Workflows are configured by delivery leadership (Admin / Project
Manager / Team Lead) and consumed by everyone else on the project.
"""

from fastapi import Depends
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenException
from app.core.permissions import has_permission
from app.modules.users.model import User


def can_manage_workflows(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Admin / Project Manager / Team Lead only: create, update, or delete
    a workflow.
    """

    if not has_permission(db, current_user, "workflow.manage"):
        raise ForbiddenException(message="Missing required permission: workflow.manage")

    return current_user


def can_view_workflows(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Any authenticated user may read workflow data.
    """

    return current_user
