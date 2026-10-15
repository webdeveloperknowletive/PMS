"""
Permissions for the milestones module.

Milestones are set and marked complete by delivery leadership; everyone
else reads them.
"""

from fastapi import Depends
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenException
from app.core.permissions import has_permission
from app.modules.users.model import User


def can_manage_milestones(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Admin / Project Manager / Team Lead only: create, update
    (including marking complete), or delete a milestone.
    """

    if not has_permission(db, current_user, "milestones.manage"):
        raise ForbiddenException(message="Missing required permission: milestones.manage")

    return current_user


def can_view_milestones(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Milestone access requires milestone or schedule permissions.
    """

    if not any(has_permission(db, current_user, code) for code in ("milestones.view", "milestones.manage", "gantt.view", "gantt.manage")):
        raise ForbiddenException(message="You do not have access to milestones")
    return current_user
