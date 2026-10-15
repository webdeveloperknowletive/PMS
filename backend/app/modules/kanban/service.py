"""
==========================================================
                KANBAN SERVICE
==========================================================

Business logic layer for Kanban Columns and Tasks (card
placements). Orchestrates calls to repository.py and
translates "not found" into HTTP errors. Routers should
only ever call this layer, never the model or repository
directly.
"""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.kanban import repository
from app.modules.kanban.model import KanbanColumn, KanbanTask
from app.modules.kanban.schema import (
    KanbanColumnCreate,
    KanbanColumnUpdate,
    KanbanTaskCreate,
    KanbanTaskUpdate,
)
from app.core.permissions import has_permission
from app.modules.projects.model import Project
from app.modules.tasks.model import Task
from app.modules.tasks.repository import get_visible_project_ids
from app.modules.teams.model import Team, TeamLead
from app.modules.users.model import User


def _board_scope(db: Session, user: User) -> tuple[set[UUID] | None, bool]:
    if has_permission(db, user, "roles.manage"):
        return None, True
    owned_project_ids = {row[0] for row in db.query(Project.project_id).filter(Project.project_manager_user_id == user.user_id).all()}
    lead_ids = db.query(TeamLead.team_lead_id).filter(TeamLead.user_id == user.user_id).subquery()
    lead_projects = {row[0] for row in db.query(Team.project_id).filter(Team.team_lead_id.in_(lead_ids)).all()}
    privileged_projects = owned_project_ids | lead_projects
    if privileged_projects:
        return privileged_projects, True
    visible = get_visible_project_ids(db, user.user_id)
    return visible, False


# ==========================================================
# Kanban Columns
# ==========================================================

def get_kanban_columns(db: Session, current_user: User, skip: int = 0, limit: int = 100) -> list[KanbanColumn]:
    """Get all Kanban columns (paginated, ordered by position)."""
    project_ids, _ = _board_scope(db, current_user)
    query = db.query(KanbanColumn)
    if project_ids is not None:
        query = query.filter(KanbanColumn.project_id.in_(project_ids)) if project_ids else query.filter(False)
    return query.order_by(KanbanColumn.position.asc()).offset(skip).limit(limit).all()


def get_kanban_column(db: Session, column_id: UUID, current_user: User) -> KanbanColumn:
    """Get a single Kanban column by ID, or raise 404."""
    column = repository.get_kanban_column(db, column_id)
    project_ids, _ = _board_scope(db, current_user)
    if column is None or (project_ids is not None and column.project_id not in project_ids):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanban column not found")
    return column


def create_kanban_column(db: Session, payload: KanbanColumnCreate) -> KanbanColumn:
    """Create a new Kanban column."""
    return repository.create_kanban_column(db, payload)


def update_kanban_column(db: Session, column_id: UUID, payload: KanbanColumnUpdate) -> KanbanColumn:
    """Update an existing Kanban column, or raise 404."""
    column = repository.update_kanban_column(db, column_id, payload)
    if column is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanban column not found")
    return column


def delete_kanban_column(db: Session, column_id: UUID) -> None:
    """Delete a Kanban column, or raise 404."""
    deleted = repository.delete_kanban_column(db, column_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanban column not found")


# ==========================================================
# Kanban Tasks (card placements)
# ==========================================================

def get_kanban_tasks(db: Session, current_user: User, skip: int = 0, limit: int = 100) -> list[KanbanTask]:
    """Get all Kanban task placements (paginated)."""
    project_ids, can_view_project_tasks = _board_scope(db, current_user)
    query = db.query(KanbanTask).join(KanbanColumn, KanbanTask.column_id == KanbanColumn.column_id).join(Task, Task.task_id == KanbanTask.task_id)
    if project_ids is not None:
        query = query.filter(KanbanColumn.project_id.in_(project_ids)) if project_ids else query.filter(False)
    if not can_view_project_tasks:
        query = query.filter(Task.user_id == current_user.user_id)
    return query.order_by(KanbanTask.position.asc()).offset(skip).limit(limit).all()


def get_kanban_task(db: Session, kanban_task_id: UUID, current_user: User) -> KanbanTask:
    """Get a single Kanban task placement by ID, or raise 404."""
    kanban_task = repository.get_kanban_task(db, kanban_task_id)
    project_ids, can_view_project_tasks = _board_scope(db, current_user)
    permitted = kanban_task is not None and (project_ids is None or kanban_task.column.project_id in project_ids) and (
        can_view_project_tasks or kanban_task.task.user_id == current_user.user_id
    )
    if not permitted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanban task not found")
    return kanban_task


def create_kanban_task(db: Session, payload: KanbanTaskCreate) -> KanbanTask:
    """Place a task on the board for the first time."""
    task = db.get(Task, payload.task_id)
    column = db.get(KanbanColumn, payload.column_id)
    if task is None or column is None or task.project_id != column.project_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose a board column from the task's project")
    return repository.create_kanban_task(db, payload)


def update_kanban_task(db: Session, kanban_task_id: UUID, payload: KanbanTaskUpdate) -> KanbanTask:
    """
    Generic field update for a Kanban task placement (e.g. correcting
    position without a full drag-move). For an actual drag-and-drop
    move between columns, use move_kanban_task() instead, so `moved_by`
    and `moved_at` get set correctly.
    """
    current = repository.get_kanban_task(db, kanban_task_id)
    if current is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanban task not found")
    if payload.column_id is not None:
        target = db.get(KanbanColumn, payload.column_id)
        if target is None or current.task.project_id != target.project_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose a board column from the task's project")
    kanban_task = repository.update_kanban_task(db, kanban_task_id, payload)
    if kanban_task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanban task not found")
    return kanban_task


def move_kanban_task(
    db: Session,
    kanban_task_id: UUID,
    column_id: UUID,
    position: int,
    moved_by: UUID,
) -> KanbanTask:
    """
    Move a task to a (possibly different) column and position, stamping
    who moved it. This is the actual "drag a card" action — previously
    only existed in repository.py and was never reachable through the
    API; every move went through the generic update instead, silently
    losing the moved_by/moved_at stamp.
    """
    current = repository.get_kanban_task(db, kanban_task_id)
    target = db.get(KanbanColumn, column_id)
    if current is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanban task not found")
    if target is None or current.task.project_id != target.project_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose a board column from the task's project")
    kanban_task = repository.move_kanban_task(db, kanban_task_id, column_id, position, moved_by=moved_by)
    if kanban_task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanban task not found")
    return kanban_task


def delete_kanban_task(db: Session, kanban_task_id: UUID) -> None:
    """Remove a task from the board, or raise 404."""
    deleted = repository.delete_kanban_task(db, kanban_task_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanban task not found")
