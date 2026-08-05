from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.gantt.model import GanttTask
from app.modules.gantt.schema import (
    GanttTaskCreate,
    GanttTaskUpdate,
)


def get_gantt_tasks(
    db: Session,
    skip: int = 0,
    limit: int = 100,
):
    """
    Get all Gantt tasks.
    """
    return (
        db.query(GanttTask)
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_gantt_task(
    db: Session,
    gantt_id: UUID,
):
    """
    Get a Gantt task by ID.
    """
    gantt_task = db.get(
        GanttTask,
        gantt_id,
    )

    if gantt_task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gantt task not found",
        )

    return gantt_task


def create_gantt_task(
    db: Session,
    payload: GanttTaskCreate,
):
    """
    Create a new Gantt task.
    """
    gantt_task = GanttTask(
        **payload.model_dump()
    )

    db.add(gantt_task)
    db.commit()
    db.refresh(gantt_task)

    return gantt_task


def update_gantt_task(
    db: Session,
    gantt_id: UUID,
    payload: GanttTaskUpdate,
):
    """
    Update an existing Gantt task.
    """
    gantt_task = db.get(
        GanttTask,
        gantt_id,
    )

    if gantt_task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gantt task not found",
        )

    for field, value in payload.model_dump(
        exclude_unset=True
    ).items():
        setattr(
            gantt_task,
            field,
            value,
        )

    db.commit()
    db.refresh(gantt_task)

    return gantt_task


def delete_gantt_task(
    db: Session,
    gantt_id: UUID,
):
    """
    Delete a Gantt task.
    """
    gantt_task = db.get(
        GanttTask,
        gantt_id,
    )

    if gantt_task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gantt task not found",
        )

    db.delete(gantt_task)
    db.commit()

    return None