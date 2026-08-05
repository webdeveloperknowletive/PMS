from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.tasks.model import Task
from app.modules.tasks.schema import (
    TaskCreate,
    TaskUpdate,
)


# ==========================================================
# Tasks
# ==========================================================

def get_tasks(
    db: Session,
    skip: int = 0,
    limit: int = 100,
):
    """
    Get all tasks.
    """
    return (
        db.query(Task)
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_task(
    db: Session,
    task_id: UUID,
):
    """
    Get task by ID.
    """
    task = db.get(
        Task,
        task_id,
    )

    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    return task


def create_task(
    db: Session,
    payload: TaskCreate,
):
    """
    Create a new task.
    """
    task = Task(
        **payload.model_dump()
    )

    db.add(task)
    db.commit()
    db.refresh(task)

    return task


def update_task(
    db: Session,
    task_id: UUID,
    payload: TaskUpdate,
):
    """
    Update an existing task.
    """
    task = db.get(
        Task,
        task_id,
    )

    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    for field, value in payload.model_dump(
        exclude_unset=True
    ).items():
        setattr(
            task,
            field,
            value,
        )

    db.commit()
    db.refresh(task)

    return task


def delete_task(
    db: Session,
    task_id: UUID,
):
    """
    Delete a task.
    """
    task = db.get(
        Task,
        task_id,
    )

    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    db.delete(task)
    db.commit()

    return None


# ==========================================================
# Subtasks
# ==========================================================

def get_subtasks(
    db: Session,
    task_id: UUID,
):
    """
    Get all subtasks for a parent task.
    """
    parent = db.get(
        Task,
        task_id,
    )

    if parent is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    return (
        db.query(Task)
        .filter(Task.parent_task_id == task_id)
        .all()
    )