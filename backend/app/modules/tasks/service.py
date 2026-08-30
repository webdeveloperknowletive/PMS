"""
==========================================================
                TASKS SERVICE
==========================================================

Business logic layer for Tasks. Orchestrates calls to
repository.py and translates "not found" into HTTP errors.
Routers should only ever call this layer, never the model
or repository directly.
"""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.tasks import repository
from app.modules.tasks.model import Task
from app.modules.tasks.schema import TaskCreate, TaskUpdate


def get_tasks(
    db: Session,
    skip: int = 0,
    limit: int = 100,
) -> list[Task]:
    """Get all tasks (paginated)."""
    return repository.get_tasks(db, skip=skip, limit=limit)


def get_task(
    db: Session,
    task_id: UUID,
) -> Task:
    """Get a single task by ID, or raise 404."""
    task = repository.get_task(db, task_id)
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
    return task


def create_task(
    db: Session,
    payload: TaskCreate,
) -> Task:
    """Create a new task."""
    return repository.create_task(db, payload)


def update_task(
    db: Session,
    task_id: UUID,
    payload: TaskUpdate,
) -> Task:
    """Update an existing task, or raise 404."""
    task = repository.update_task(db, task_id, payload)
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
    return task


def delete_task(
    db: Session,
    task_id: UUID,
) -> None:
    """Delete a task, or raise 404."""
    deleted = repository.delete_task(db, task_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )


def get_subtasks(
    db: Session,
    task_id: UUID,
) -> list[Task]:
    """Get all subtasks of a parent task, or raise 404 if the parent doesn't exist."""
    parent = repository.get_task(db, task_id)
    if parent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
    return repository.get_subtasks(db, task_id)
