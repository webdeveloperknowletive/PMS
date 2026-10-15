"""
Permissions for the calendar module.

Any authenticated user may create an event they organize; only the
organizer, or delivery leadership, may update or delete it. Everyone
authenticated may read the calendar.
"""

from fastapi import Depends
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenException
from app.core.permissions import has_permission
from app.modules.users.model import User


def can_create_event(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Any authenticated user may schedule a calendar event.
    """

    if not has_permission(db, current_user, "calendar.create"):
        raise ForbiddenException(message="Missing required permission: calendar.create")
    return current_user


def can_modify_event(
    organizer_id,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    The organizer, or delivery leadership, may update/delete an event.
    """

    if current_user.user_id == organizer_id:
        return current_user

    if not has_permission(db, current_user, "calendar.manage"):
        raise ForbiddenException(
            message="You may only modify events you organize"
        )

    return current_user


def can_view_calendar(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Calendar access is limited to users who can create or manage events.
    """

    if not any(has_permission(db, current_user, code) for code in ("calendar.view", "calendar.create", "calendar.manage")):
        raise ForbiddenException(message="You do not have access to the calendar")
    return current_user
