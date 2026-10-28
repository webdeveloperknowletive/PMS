"""
==========================================================
                TASKS REPOSITORY
==========================================================

Data-access layer for the Task model.
"""

# ==========================================================
# Import Required Modules
# ==========================================================

from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.tasks.model import Task, TaskLink
from app.modules.tasks.schema import TaskCreate, TaskUpdate
from app.modules.teams.model import Team, TeamLead, TeamMember
from app.modules.projects.model import Project
from sqlalchemy import func, or_

from app.modules.kanban.model import KanbanColumn, KanbanTask

# ==========================================================
# Create
# ==========================================================

def create_task(
    db: Session,
    payload: TaskCreate,
    *,
    commit: bool = True,
) -> Task:

    task_data = payload.model_dump(exclude={"kanban_column_id", "kanban_position"})
    task_data["checklist_items"] = [item.model_dump(mode="json") for item in payload.checklist_items]
    task = Task(**task_data)

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


def list_filtered_tasks(
    query,
    *,
    db: Session,
    skip: int,
    limit: int,
    search: str | None = None,
    project_id: UUID | None = None,
    assignee_id: UUID | None = None,
    task_status: str | None = None,
    priority: str | None = None,
    component_id: UUID | None = None,
    release_id: UUID | None = None,
    label: str | None = None,
    overdue: bool = False,
    due_after: date | None = None,
    due_before: date | None = None,
    backlog: bool = False,
    blocked: bool = False,
) -> list[Task]:
    """Apply filters to an already permission-scoped task query."""
    if search:
        escaped = search.replace("!", "!!").replace("%", "!%").replace("_", "!_")
        pattern = f"%{escaped}%"
        query = query.filter(or_(Task.task_name.ilike(pattern, escape="!"), Task.description.ilike(pattern, escape="!")))
    if project_id:
        query = query.filter(Task.project_id == project_id)
    if assignee_id:
        query = query.filter(Task.user_id == assignee_id)
    if task_status:
        query = query.filter(Task.status == task_status)
    if priority:
        query = query.filter(Task.priority == priority)
    if component_id:
        query = query.filter(Task.component_id == component_id)
    if release_id:
        query = query.filter(Task.release_id == release_id)
    if label:
        query = query.filter(Task.labels.contains([label.casefold()]))
    if overdue:
        query = query.filter(Task.due_date < date.today(), Task.status.notin_(("DONE", "CANCELLED")))
    if due_after:
        query = query.filter(Task.due_date >= due_after)
    if due_before:
        query = query.filter(Task.due_date <= due_before)
    if backlog:
        query = query.filter(Task.status == "TODO", Task.sprint_id.is_(None))
        return query.join(Project, Project.project_id == Task.project_id).order_by(
            Project.project_name.asc(), Task.backlog_rank.asc(), Task.created_at.asc(), Task.task_id.asc()
        ).offset(skip).limit(limit).all()
    if blocked:
        open_blocker_targets = db.query(TaskLink.target_task_id).join(
            Task, Task.task_id == TaskLink.source_task_id,
        ).filter(
            TaskLink.link_type == "BLOCKS",
            Task.status.notin_(("DONE", "CANCELLED")),
        ).distinct()
        board_blocked_tasks = db.query(KanbanTask.task_id).join(
            KanbanColumn, KanbanColumn.column_id == KanbanTask.column_id,
        ).filter(func.upper(func.trim(KanbanColumn.column_name)) == "BLOCKED").distinct()
        query = query.filter(or_(
            Task.status == "BLOCKED",
            Task.task_id.in_(open_blocker_targets),
            Task.task_id.in_(board_blocked_tasks),
        ))
    return query.order_by(Task.created_at.desc()).offset(skip).limit(limit).all()


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


def get_tasks_by_project_ids(
    db: Session,
    project_ids: set[UUID],
    skip: int = 0,
    limit: int = 100,
) -> list[Task]:
    if not project_ids:
        return []
    return db.query(Task).filter(Task.project_id.in_(project_ids)).order_by(
        Task.created_at.desc()
    ).offset(skip).limit(limit).all()


def get_visible_project_ids(db: Session, user_id: UUID) -> set[UUID]:
    project_ids = {
        row[0]
        for row in db.query(Project.project_id)
        .filter(Project.project_manager_user_id == user_id)
        .all()
    }
    lead_ids = [
        row[0]
        for row in db.query(TeamLead.team_lead_id)
        .filter(TeamLead.user_id == user_id)
        .all()
    ]
    project_ids.update({
        row[0]
        for row in db.query(Team.project_id)
        .filter(Team.team_lead_id.in_(lead_ids))
        .all()
    } if lead_ids else set())
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

    update_data = payload.model_dump(exclude_unset=True)
    if "checklist_items" in update_data and payload.checklist_items is not None:
        update_data["checklist_items"] = [item.model_dump(mode="json") for item in payload.checklist_items]
    for field, value in update_data.items():
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
    *,
    commit: bool = True,
) -> bool:

    task = db.get(Task, task_id)

    if task is None:
        return False

    db.delete(task)
    if commit:
        db.commit()
    else:
        db.flush()

    return True
