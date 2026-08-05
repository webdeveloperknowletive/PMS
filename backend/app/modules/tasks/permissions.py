"""
Permissions for the tasks module.

- Admin / Project Manager / Team Lead may create, reassign, or delete
  any task.
- Developers and Testers may update the tasks assigned to them
  (typically moving `status`), but not create or delete tasks, and not
  touch tasks assigned to someone else.
- Viewers are read-only.
"""

from fastapi import Depends
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenException
from app.core.permissions import (
    CONTRIBUTOR_ROLES,
    DELIVERY_LEAD_ROLES,
    user_has_any_role,
)
from app.modules.users.model import User


def can_manage_tasks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Admin / Project Manager / Team Lead only: create, reassign, or
    delete a task.
    """

    if not user_has_any_role(db, current_user, DELIVERY_LEAD_ROLES):
        raise ForbiddenException(
            message=f"Requires one of the following roles: {', '.join(DELIVERY_LEAD_ROLES)}"
        )

    return current_user


def can_update_task(
    task_assignee_id,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Delivery leads may update any task; Developers/Testers may only
    update a task assigned to them.
    """

    if user_has_any_role(db, current_user, DELIVERY_LEAD_ROLES):
        return current_user

    if (
        task_assignee_id == current_user.user_id
        and user_has_any_role(db, current_user, CONTRIBUTOR_ROLES)
    ):
        return current_user

    raise ForbiddenException(
        message="You may only update tasks assigned to you"
    )


def can_view_tasks(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Any authenticated user may read task data.
    """

    return current_user
