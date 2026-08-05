"""
Permissions for the users module.

- Anyone authenticated may read the user list/detail (needed for
  assigning tasks, teams, etc.) and update their own profile.
- Only Admins may create users directly (registration goes through
  `auth.register` instead), deactivate/delete other users, or edit a
  profile that isn't their own.
"""

from fastapi import Depends
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenException
from app.core.permissions import ROLE_ADMIN, is_admin
from app.modules.users.model import User


def can_manage_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Admin-only: create, deactivate, or delete any user account.
    """

    if not is_admin(db, current_user):
        raise ForbiddenException(
            message=f"Requires the '{ROLE_ADMIN}' role"
        )

    return current_user


def can_modify_user(
    target_user_id,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    A user may modify their own profile; Admins may modify anyone's.
    """

    if current_user.user_id == target_user_id:
        return current_user

    if not is_admin(db, current_user):
        raise ForbiddenException(
            message="You may only modify your own user profile"
        )

    return current_user
