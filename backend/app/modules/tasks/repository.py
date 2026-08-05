"""
==========================================================
                TASKS REPOSITORY
==========================================================

Data-access layer for the Task model.
"""

# ==========================================================
# Import Required Modules
# ==========================================================

from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.tasks.model import Task
from app.modules.tasks.schema import TaskCreate, TaskUpdate


# ==========================================================
# Create
# ==========================================================

def create_task(
    db: Session,
    payload: TaskCreate,
) -> Task:

    task = Task(**payload.model_dump())

    db.add(task)
    db.commit()
    db.refresh(task)

    return task


# ==========================================================
# Read
# ==========================================================

def get_task(
    db: Session,
    task_id: UUID,
) -> Task | None:

    return db.get(Task, task_id)


def get_tasks(
    db: Session,
    skip: int = 0,
    limit: int = 100,
) -> list[Task]:

    return (
        db.query(Task)
        .order_by(Task.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_tasks_by_project(
    db: Session,
    project_id: UUID,
    skip: int = 0,
    limit: int = 100,
) -> list[Task]:

    return (
        db.query(Task)
        .filter(Task.project_id == project_id)
        .order_by(Task.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_tasks_by_assignee(
    db: Session,
    user_id: UUID,
    skip: int = 0,
    limit: int = 100,
) -> list[Task]:

    return (
        db.query(Task)
        .filter(Task.user_id == user_id)
        .order_by(Task.due_date.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_tasks_by_status(
    db: Session,
    project_id: UUID,
    status: str,
) -> list[Task]:

    return (
        db.query(Task)
        .filter(
            Task.project_id == project_id,
            Task.status == status,
        )
        .all()
    )


def get_tasks_by_sprint_plan(
    db: Session,
    sprint_plan_id: UUID,
) -> list[Task]:

    return (
        db.query(Task)
        .filter(Task.sprint_plan_id == sprint_plan_id)
        .all()
    )


def get_subtasks(
    db: Session,
    parent_task_id: UUID,
) -> list[Task]:

    return (
        db.query(Task)
        .filter(Task.parent_task_id == parent_task_id)
        .all()
    )


def count_tasks_by_project(
    db: Session,
    project_id: UUID,
) -> int:

    return (
        db.query(Task)
        .filter(Task.project_id == project_id)
        .count()
    )


# ==========================================================
# Update
# ==========================================================

def update_task(
    db: Session,
    task_id: UUID,
    payload: TaskUpdate,
) -> Task | None:

    task = db.get(Task, task_id)

    if task is None:
        return None

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)

    return task


def update_task_status(
    db: Session,
    task_id: UUID,
    status: str,
) -> Task | None:

    task = db.get(Task, task_id)

    if task is None:
        return None

    task.status = status

    db.commit()
    db.refresh(task)

    return task


# ==========================================================
# Delete
# ==========================================================

def delete_task(
    db: Session,
    task_id: UUID,
) -> bool:

    task = db.get(Task, task_id)

    if task is None:
        return False

    db.delete(task)
    db.commit()

    return True
