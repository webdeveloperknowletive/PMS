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


# ==========================================================
# Kanban Columns
# ==========================================================

def get_kanban_columns(db: Session, skip: int = 0, limit: int = 100) -> list[KanbanColumn]:
    """Get all Kanban columns (paginated, ordered by position)."""
    return repository.get_kanban_columns(db, skip=skip, limit=limit)


def get_kanban_column(db: Session, column_id: UUID) -> KanbanColumn:
    """Get a single Kanban column by ID, or raise 404."""
    column = repository.get_kanban_column(db, column_id)
    if column is None:
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

def get_kanban_tasks(db: Session, skip: int = 0, limit: int = 100) -> list[KanbanTask]:
    """Get all Kanban task placements (paginated)."""
    return repository.get_kanban_tasks(db, skip=skip, limit=limit)


def get_kanban_task(db: Session, kanban_task_id: UUID) -> KanbanTask:
    """Get a single Kanban task placement by ID, or raise 404."""
    kanban_task = repository.get_kanban_task(db, kanban_task_id)
    if kanban_task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanban task not found")
    return kanban_task


def create_kanban_task(db: Session, payload: KanbanTaskCreate) -> KanbanTask:
    """Place a task on the board for the first time."""
    return repository.create_kanban_task(db, payload)


def update_kanban_task(db: Session, kanban_task_id: UUID, payload: KanbanTaskUpdate) -> KanbanTask:
    """
    Generic field update for a Kanban task placement (e.g. correcting
    position without a full drag-move). For an actual drag-and-drop
    move between columns, use move_kanban_task() instead, so `moved_by`
    and `moved_at` get set correctly.
    """
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
    kanban_task = repository.move_kanban_task(db, kanban_task_id, column_id, position, moved_by=moved_by)
    if kanban_task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanban task not found")
    return kanban_task


def delete_kanban_task(db: Session, kanban_task_id: UUID) -> None:
    """Remove a task from the board, or raise 404."""
    deleted = repository.delete_kanban_task(db, kanban_task_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanban task not found")
