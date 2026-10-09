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
from app.modules.teams.model import Team, TeamLead, TeamMember


# ==========================================================
# Create
# ==========================================================

def create_task(
    db: Session,
    payload: TaskCreate,
    *,
    commit: bool = True,
) -> Task:

    task = Task(**payload.model_dump())

    db.add(task)
    if commit:
        db.commit()
    else:
        db.flush()
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


def get_tasks_for_user(
    db: Session,
    user_id: UUID,
    project_ids: set[UUID],
    skip: int = 0,
    limit: int = 100,
) -> list[Task]:
    query = db.query(Task).filter(Task.user_id == user_id)
    if project_ids:
        query = db.query(Task).filter(
            (Task.user_id == user_id) | (Task.project_id.in_(project_ids))
        )
    return query.order_by(Task.created_at.desc()).offset(skip).limit(limit).all()


def get_visible_project_ids(db: Session, user_id: UUID) -> set[UUID]:
    lead_ids = [
        row[0]
        for row in db.query(TeamLead.team_lead_id)
        .filter(TeamLead.user_id == user_id)
        .all()
    ]
    project_ids = {
        row[0]
        for row in db.query(Team.project_id)
        .filter(Team.team_lead_id.in_(lead_ids))
        .all()
    } if lead_ids else set()
    project_ids.update(
        row[0]
        for row in db.query(Team.project_id)
        .join(TeamMember, TeamMember.team_id == Team.team_id)
        .filter(TeamMember.user_id == user_id)
        .all()
    )
    return project_ids


def task_is_visible_to_user(db: Session, task: Task, user_id: UUID, project_ids: set[UUID]) -> bool:
    return task.user_id == user_id or task.project_id in project_ids


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


def get_visible_subtasks(
    db: Session,
    parent_task_id: UUID,
    user_id: UUID,
    project_ids: set[UUID],
) -> list[Task]:
    query = db.query(Task).filter(Task.parent_task_id == parent_task_id)
    query = query.filter((Task.user_id == user_id) | (Task.project_id.in_(project_ids))) if project_ids else query.filter(Task.user_id == user_id)
    return query.all()


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
    *,
    commit: bool = True,
) -> Task | None:

    task = db.get(Task, task_id)

    if task is None:
        return None

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, value)

    if commit:
        db.commit()
    else:
        db.flush()
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
