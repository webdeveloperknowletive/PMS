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
from app.core.permissions import CONTRIBUTOR_ROLES, DELIVERY_LEAD_ROLES, user_has_any_role
from app.modules.users.model import User


def can_manage_board(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Admin / Project Manager / Team Lead only: create, rename, reorder,
    or delete a Kanban column.
    """

    if not user_has_any_role(db, current_user, DELIVERY_LEAD_ROLES):
        raise ForbiddenException(
            message=f"Requires one of the following roles: {', '.join(DELIVERY_LEAD_ROLES)}"
        )

    return current_user


def can_move_task(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Any contributor may move a task between columns.
    """

    if not user_has_any_role(db, current_user, CONTRIBUTOR_ROLES):
        raise ForbiddenException(
            message=f"Requires one of the following roles: {', '.join(CONTRIBUTOR_ROLES)}"
        )

    return current_user


def can_view_board(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Any authenticated user may view the Kanban board.
    """

    return current_user
