from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.kanban.model import (
    KanbanColumn,
    KanbanTask,
)
from app.modules.kanban.schema import (
    KanbanColumnCreate,
    KanbanColumnUpdate,
    KanbanTaskCreate,
    KanbanTaskUpdate,
)


# ==========================================================
# Kanban Columns
# ==========================================================

def get_kanban_columns(
    db: Session,
):
    """
    Get all Kanban columns.
    """
    return db.query(KanbanColumn).all()


def get_kanban_column(
    db: Session,
    column_id: UUID,
):
    """
    Get a Kanban column by ID.
    """
    column = db.get(
        KanbanColumn,
        column_id,
    )

    if column is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kanban column not found",
        )

    return column


def create_kanban_column(
    db: Session,
    payload: KanbanColumnCreate,
):
    """
    Create a new Kanban column.
    """
    column = KanbanColumn(
        **payload.model_dump()
    )

    db.add(column)
    db.commit()
    db.refresh(column)

    return column


def update_kanban_column(
    db: Session,
    column_id: UUID,
    payload: KanbanColumnUpdate,
):
    """
    Update a Kanban column.
    """
    column = db.get(
        KanbanColumn,
        column_id,
    )

    if column is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kanban column not found",
        )

    for field, value in payload.model_dump(
        exclude_unset=True
    ).items():
        setattr(
            column,
            field,
            value,
        )

    db.commit()
    db.refresh(column)

    return column


def delete_kanban_column(
    db: Session,
    column_id: UUID,
):
    """
    Delete a Kanban column.
    """
    column = db.get(
        KanbanColumn,
        column_id,
    )

    if column is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kanban column not found",
        )

    db.delete(column)
    db.commit()

    return None


# ==========================================================
# Kanban Tasks
# ==========================================================

def get_kanban_tasks(
    db: Session,
):
    """
    Get all Kanban tasks.
    """
    return db.query(KanbanTask).all()


def get_kanban_task(
    db: Session,
    task_id: UUID,
):
    """
    Get a Kanban task by ID.
    """
    kanban_task = db.get(
        KanbanTask,
        task_id,
    )

    if kanban_task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kanban task not found",
        )

    return kanban_task


def create_kanban_task(
    db: Session,
    payload: KanbanTaskCreate,
):
    """
    Create a new Kanban task.
    """
    kanban_task = KanbanTask(
        **payload.model_dump()
    )

    db.add(kanban_task)
    db.commit()
    db.refresh(kanban_task)

    return kanban_task


def update_kanban_task(
    db: Session,
    task_id: UUID,
    payload: KanbanTaskUpdate,
):
    """
    Update a Kanban task.
    """
    kanban_task = db.get(
        KanbanTask,
        task_id,
    )

    if kanban_task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kanban task not found",
        )

    for field, value in payload.model_dump(
        exclude_unset=True
    ).items():
        setattr(
            kanban_task,
            field,
            value,
        )

    db.commit()
    db.refresh(kanban_task)

    return kanban_task


def delete_kanban_task(
    db: Session,
    task_id: UUID,
):
    """
    Delete a Kanban task.
    """
    kanban_task = db.get(
        KanbanTask,
        task_id,
    )

    if kanban_task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kanban task not found",
        )

    db.delete(kanban_task)
    db.commit()

    return None