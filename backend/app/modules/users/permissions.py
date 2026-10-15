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
from app.core.permissions import has_permission, is_system_role_assigned
from app.modules.roles.model import Role, UserRole
from app.modules.users.model import User


def can_manage_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Admin-only: create, deactivate, or delete any user account.
    """

    if not has_permission(db, current_user, "users.manage"):
        raise ForbiddenException(
            message="Missing required permission: users.manage"
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

    target_is_super_admin = db.query(UserRole.user_role_id).join(Role, Role.role_id == UserRole.role_id).filter(
        UserRole.user_id == target_user_id,
        Role.is_system.is_(True),
    ).first() is not None
    if target_is_super_admin and not is_system_role_assigned(db, current_user):
        raise ForbiddenException(message="Super Admin accounts are private")

    if not has_permission(db, current_user, "users.manage"):
        raise ForbiddenException(
            message="You may only modify your own user profile"
        )

    return current_user
