"""
Permissions for the kanban module.

- Admin / Project Manager / Team Lead configure the board (create,
  rename, reorder, or delete columns).
- Any contributor (Developer/Tester, in addition to the leads above)
  may move a task between columns.
- Viewers are read-only.
"""

from fastapi import Depends
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenException
from app.core.permissions import has_permission
from app.modules.users.model import User


def can_manage_board(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Admin / Project Manager / Team Lead only: create, rename, reorder,
    or delete a Kanban column.
    """

    if not has_permission(db, current_user, "kanban.manage"):
        raise ForbiddenException(message="Missing required permission: kanban.manage")

    return current_user


def can_move_task(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Any contributor may move a task between columns.
    """

    if not has_permission(db, current_user, "kanban.move"):
        raise ForbiddenException(message="Missing required permission: kanban.move")

    return current_user


def can_view_board(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Require board management or task movement access.
    """

    if not any(has_permission(db, current_user, code) for code in ("kanban.view", "kanban.manage", "kanban.move")):
        raise ForbiddenException(message="You do not have access to Kanban boards")
    return current_user
