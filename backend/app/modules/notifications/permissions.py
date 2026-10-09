"""
Permissions for the notifications module.

Notifications are personal: a user may only read or mark their own
notifications as read. Only Admins (or the system, via internal
service calls) may create notifications on behalf of another user.
"""

from fastapi import Depends
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenException
from app.core.permissions import has_permission
from app.modules.users.model import User


def can_access_notification(
    notification_owner_id,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    A user may read/update (mark read) only their own notifications;
    Admins may access any user's notifications.
    """

    if current_user.user_id == notification_owner_id:
        return current_user

    if not has_permission(db, current_user, "roles.manage"):
        raise ForbiddenException(
            message="You may only access your own notifications"
        )

    return current_user


def can_create_notification(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Admin-only: create/broadcast a notification for another user.
    """

    if not has_permission(db, current_user, "roles.manage"):
        raise ForbiddenException(
            message="Only Admins may create notifications for other users"
        )

    return current_user
