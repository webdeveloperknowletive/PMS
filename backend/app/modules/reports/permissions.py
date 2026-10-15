"""
Permissions for the reports module.

Generating and deleting reports is restricted to delivery leadership;
everyone authenticated may read a project's reports.
"""

from fastapi import Depends
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenException
from app.core.permissions import has_permission
from app.modules.users.model import User


def can_manage_reports(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Admin / Project Manager / Team Lead only: generate or delete a report.
    """

    if not any(has_permission(db, current_user, code) for code in ("reports.view", "reports.manage")):
        raise ForbiddenException(message="Missing required permission: reports.manage")

    return current_user


def can_view_reports(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Report access requires report management permission.
    """

    if not has_permission(db, current_user, "reports.manage"):
        raise ForbiddenException(message="You do not have access to reports")
    return current_user
