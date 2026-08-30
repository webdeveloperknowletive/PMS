"""
==========================================================
                GANTT REPOSITORY
==========================================================

Data-access layer for the GanttTask model.
"""

# ==========================================================
# Import Required Modules
# ==========================================================

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.gantt.model import GanttTask
from app.modules.gantt.schema import GanttTaskCreate, GanttTaskUpdate

def get_gantt_tasks(
    db: Session,
    skip: int = 0,
    limit: int = 100,
) -> list[GanttTask]:

    return (
        db.query(GanttTask)
        .order_by(GanttTask.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )



# ==========================================================
# Create
# ==========================================================

def create_gantt_task(
    db: Session,
    payload: GanttTaskCreate,
) -> GanttTask:

    gantt_task = GanttTask(**payload.model_dump())

    db.add(gantt_task)
    db.commit()
    db.refresh(gantt_task)

    return gantt_task


# ==========================================================
# Read
# ==========================================================

def get_gantt_task(
    db: Session,
    gantt_id: UUID,
) -> GanttTask | None:

    return db.get(GanttTask, gantt_id)


def get_gantt_tasks_by_project(
    db: Session,
    project_id: UUID,
    skip: int = 0,
    limit: int = 100,
) -> list[GanttTask]:

    return (
        db.query(GanttTask)
        .filter(GanttTask.project_id == project_id)
        .order_by(GanttTask.start_date.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_gantt_entries_by_task(
    db: Session,
    task_id: UUID,
) -> list[GanttTask]:

    return (
        db.query(GanttTask)
        .filter(GanttTask.task_id == task_id)
        .all()
    )


def get_gantt_dependents(
    db: Session,
    gantt_id: UUID,
) -> list[GanttTask]:

    return (
        db.query(GanttTask)
        .filter(GanttTask.dependency_task == gantt_id)
        .all()
    )


# ==========================================================
# Update
# ==========================================================

def update_gantt_task(
    db: Session,
    gantt_id: UUID,
    payload: GanttTaskUpdate,
) -> GanttTask | None:

    gantt_task = db.get(GanttTask, gantt_id)

    if gantt_task is None:
        return None

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(gantt_task, field, value)

    db.commit()
    db.refresh(gantt_task)

    return gantt_task


def update_gantt_progress(
    db: Session,
    gantt_id: UUID,
    progress: Decimal,
) -> GanttTask | None:

    gantt_task = db.get(GanttTask, gantt_id)

    if gantt_task is None:
        return None

    gantt_task.progress = progress

    db.commit()
    db.refresh(gantt_task)

    return gantt_task


# ==========================================================
# Delete
# ==========================================================

def delete_gantt_task(
    db: Session,
    gantt_id: UUID,
) -> bool:

    gantt_task = db.get(GanttTask, gantt_id)

    if gantt_task is None:
        return False

    db.delete(gantt_task)
    db.commit()

    return True
