"""
Permissions for the gantt module.

Scheduling (dates, dependencies, progress) is managed by delivery
leadership; everyone else reads the chart.
"""

from fastapi import Depends
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenException
from app.core.permissions import has_permission
from app.modules.users.model import User


def can_manage_schedule(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Admin / Project Manager / Team Lead only: create, reschedule, or
    delete a Gantt entry.
    """

    if not has_permission(db, current_user, "gantt.manage"):
        raise ForbiddenException(message="Missing required permission: gantt.manage")

    return current_user


def can_view_schedule(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Any authenticated user may view the Gantt chart.
    """

    return current_user
