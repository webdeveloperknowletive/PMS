"""
==========================================================
                KANBAN REPOSITORY
==========================================================

Data-access layer for KanbanColumn and KanbanTask.
"""

# ==========================================================
# Import Required Modules
# ==========================================================

from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.kanban.model import KanbanColumn, KanbanTask
from app.modules.kanban.schema import (
    KanbanColumnCreate,
    KanbanColumnUpdate,
    KanbanTaskCreate,
    KanbanTaskUpdate,
)


# ==========================================================
# Kanban Column
# ==========================================================

def create_kanban_column(
    db: Session,
    payload: KanbanColumnCreate,
) -> KanbanColumn:

    column = KanbanColumn(**payload.model_dump())

    db.add(column)
    db.commit()
    db.refresh(column)

    return column


def get_kanban_column(
    db: Session,
    column_id: UUID,
) -> KanbanColumn | None:

    return db.get(KanbanColumn, column_id)


def get_kanban_columns_by_project(
    db: Session,
    project_id: UUID,
) -> list[KanbanColumn]:

    return (
        db.query(KanbanColumn)
        .filter(KanbanColumn.project_id == project_id)
        .order_by(KanbanColumn.position.asc())
        .all()
    )


def get_kanban_column_by_position(
    db: Session,
    project_id: UUID,
    position: int,
) -> KanbanColumn | None:

    return (
        db.query(KanbanColumn)
        .filter(
            KanbanColumn.project_id == project_id,
            KanbanColumn.position == position,
        )
        .first()
    )


def update_kanban_column(
    db: Session,
    column_id: UUID,
    payload: KanbanColumnUpdate,
) -> KanbanColumn | None:

    column = db.get(KanbanColumn, column_id)

    if column is None:
        return None

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(column, field, value)

    db.commit()
    db.refresh(column)

    return column


def delete_kanban_column(
    db: Session,
    column_id: UUID,
) -> bool:

    column = db.get(KanbanColumn, column_id)

    if column is None:
        return False

    db.delete(column)
    db.commit()

    return True


# ==========================================================
# Kanban Task
# ==========================================================

def create_kanban_task(
    db: Session,
    payload: KanbanTaskCreate,
) -> KanbanTask:

    kanban_task = KanbanTask(**payload.model_dump())

    db.add(kanban_task)
    db.commit()
    db.refresh(kanban_task)

    return kanban_task


def get_kanban_task(
    db: Session,
    kanban_task_id: UUID,
) -> KanbanTask | None:

    return db.get(KanbanTask, kanban_task_id)


def get_kanban_task_by_task(
    db: Session,
    task_id: UUID,
) -> KanbanTask | None:

    return (
        db.query(KanbanTask)
        .filter(KanbanTask.task_id == task_id)
        .first()
    )


def get_kanban_tasks_by_column(
    db: Session,
    column_id: UUID,
) -> list[KanbanTask]:

    return (
        db.query(KanbanTask)
        .filter(KanbanTask.column_id == column_id)
        .order_by(KanbanTask.position.asc())
        .all()
    )


def update_kanban_task(
    db: Session,
    kanban_task_id: UUID,
    payload: KanbanTaskUpdate,
) -> KanbanTask | None:

    kanban_task = db.get(KanbanTask, kanban_task_id)

    if kanban_task is None:
        return None

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(kanban_task, field, value)

    db.commit()
    db.refresh(kanban_task)

    return kanban_task


def move_kanban_task(
    db: Session,
    kanban_task_id: UUID,
    column_id: UUID,
    position: int,
    moved_by: UUID | None = None,
) -> KanbanTask | None:

    kanban_task = db.get(KanbanTask, kanban_task_id)

    if kanban_task is None:
        return None

    kanban_task.column_id = column_id
    kanban_task.position = position

    if moved_by is not None:
        kanban_task.moved_by = moved_by

    db.commit()
    db.refresh(kanban_task)

    return kanban_task


def delete_kanban_task(
    db: Session,
    kanban_task_id: UUID,
) -> bool:

    kanban_task = db.get(KanbanTask, kanban_task_id)

    if kanban_task is None:
        return False

    db.delete(kanban_task)
    db.commit()

    return True
