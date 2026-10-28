"""
Permissions for the kanban module.

- Admin / Project Manager / Team Lead configure the board (create,
  rename, reorder, or delete columns).
- Any contributor (Developer/Tester, in addition to the leads above)
  may move a task between columns.
- Viewers are read-only.
"""

from uuid import UUID

from fastapi import Depends, Request
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
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Any contributor may move a task between columns.
    """

    if has_permission(db, current_user, "kanban.move"):
        return current_user

    # Project Managers can move cards on projects assigned to them, without
    # receiving organization-wide Kanban movement access.
    endpoint = request.url.path.rstrip("/").split("/")
    can_move_assigned_project_card = (
        (request.method == "PUT" and len(endpoint) >= 3 and endpoint[-3:-1] == ["kanban", "tasks"])
        or (request.method == "PATCH" and len(endpoint) >= 4 and endpoint[-4:-2] == ["kanban", "tasks"] and endpoint[-1] == "move")
    )
    if can_move_assigned_project_card:
        try:
            placement_id = UUID(endpoint[-1] if request.method == "PUT" else endpoint[-2])
        except (ValueError, IndexError):
            placement_id = None
        if placement_id is not None:
            from app.modules.kanban.model import KanbanTask
            from app.modules.projects.model import Project
            from app.modules.tasks.model import Task

            assigned_project = db.query(Project.project_id).join(
                Task, Task.project_id == Project.project_id
            ).join(
                KanbanTask, KanbanTask.task_id == Task.task_id
            ).filter(
                KanbanTask.kanban_task_id == placement_id,
                Project.project_manager_user_id == current_user.user_id,
                Project.organization_id == current_user.organization_id,
            ).first()
            if assigned_project:
                return current_user

    raise ForbiddenException(message="Missing required permission: kanban.move")


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
