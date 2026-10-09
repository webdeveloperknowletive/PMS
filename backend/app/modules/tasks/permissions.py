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
from app.core.permissions import has_permission
from app.modules.users.model import User


def can_manage_tasks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Admin / Project Manager / Team Lead only: create, reassign, or
    delete a task.
    """

    if not has_permission(db, current_user, "tasks.manage"):
        raise ForbiddenException(message="Missing required permission: tasks.manage")

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

    if has_permission(db, current_user, "tasks.manage"):
        return current_user

    if (
        task_assignee_id == current_user.user_id
        and has_permission(db, current_user, "tasks.update_assigned")
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
