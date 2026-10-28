"""
==========================================================
                GANTT SERVICE
==========================================================

Business logic layer for Gantt Tasks. Orchestrates calls
to repository.py and translates "not found" into HTTP
errors. Routers should only ever call this layer, never
the model or repository directly.
"""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.gantt import repository
from app.modules.gantt.model import GanttTask
from app.modules.gantt.schema import GanttTaskCreate, GanttTaskUpdate
from app.modules.notifications.events import notify_project_users
from app.modules.projects.model import Project
from app.modules.tasks.model import Task
from app.modules.users.model import User


def get_gantt_tasks(db: Session, current_user: User, skip: int = 0, limit: int = 100) -> list[GanttTask]:
    """Get schedule entries from the signed-in user's organization."""
    return db.query(GanttTask).filter(
        GanttTask.organization_id == current_user.organization_id,
    ).order_by(GanttTask.created_at.desc()).offset(skip).limit(limit).all()


def get_gantt_task(db: Session, gantt_id: UUID, current_user: User) -> GanttTask:
    """Get one schedule entry from the signed-in user's organization."""
    gantt_task = db.query(GanttTask).filter(
        GanttTask.gantt_id == gantt_id,
        GanttTask.organization_id == current_user.organization_id,
    ).one_or_none()
    if gantt_task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gantt task not found")
    return gantt_task


def create_gantt_task(db: Session, payload: GanttTaskCreate, actor: User) -> GanttTask:
    """Create a schedule entry after validating its project and dependency links."""
    project = db.query(Project.project_id).filter(
        Project.project_id == payload.project_id,
        Project.organization_id == actor.organization_id,
    ).one_or_none()
    task = db.query(Task).filter(
        Task.task_id == payload.task_id,
        Task.organization_id == actor.organization_id,
    ).one_or_none()
    if project is None or task is None or task.project_id != payload.project_id:
        raise HTTPException(status_code=400, detail="Choose a task from this project")
    if db.query(GanttTask.gantt_id).filter(GanttTask.task_id == payload.task_id).first():
        raise HTTPException(status_code=409, detail="This task already has a Gantt schedule")
    _validate_dependency(db, payload.dependency_task, payload.project_id, None)
    entry = repository.create_gantt_task(db, payload)
    notify_project_users(db, entry.project_id, actor_id=actor.user_id,
        title="Task added to Gantt schedule", message=f"{actor.name} scheduled a task on the project timeline.",
        notification_type="Schedule Created")
    return entry


def update_gantt_task(db: Session, gantt_id: UUID, payload: GanttTaskUpdate, actor: User) -> GanttTask:
    """Update an existing schedule after validating merged dates and dependencies."""
    current = get_gantt_task(db, gantt_id, actor)
    values = payload.model_dump(exclude_unset=True)
    start_date = values.get("start_date", current.start_date)
    end_date = values.get("end_date", current.end_date)
    if end_date < start_date:
        raise HTTPException(status_code=400, detail="End date must be on or after start date")
    if "dependency_task" in values:
        _validate_dependency(db, values["dependency_task"], current.project_id, current.gantt_id)
    gantt_task = repository.update_gantt_task(db, gantt_id, payload)
    if gantt_task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gantt task not found")
    notify_project_users(db, gantt_task.project_id, actor_id=actor.user_id,
        title="Gantt schedule updated", message=f"{actor.name} updated a task on the project timeline.",
        notification_type="Schedule Updated")
    return gantt_task


def _validate_dependency(db: Session, dependency_id: UUID | None, project_id: UUID, current_id: UUID | None) -> None:
    if dependency_id is None:
        return
    dependency = db.get(GanttTask, dependency_id)
    if dependency is None or dependency.project_id != project_id:
        raise HTTPException(status_code=400, detail="Choose a dependency from this project")
    if current_id is not None and dependency.gantt_id == current_id:
        raise HTTPException(status_code=400, detail="A schedule cannot depend on itself")

    visited: set[UUID] = set()
    cursor = dependency
    while cursor is not None and cursor.gantt_id not in visited:
        if current_id is not None and cursor.gantt_id == current_id:
            raise HTTPException(status_code=409, detail="This dependency would create a schedule cycle")
        visited.add(cursor.gantt_id)
        cursor = db.get(GanttTask, cursor.dependency_task) if cursor.dependency_task else None


def delete_gantt_task(db: Session, gantt_id: UUID, actor: User) -> None:
    """Delete a gantt task, or raise 404."""
    entry = get_gantt_task(db, gantt_id, actor)
    project_id = entry.project_id
    deleted = repository.delete_gantt_task(db, gantt_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gantt task not found")
    notify_project_users(db, project_id, actor_id=actor.user_id,
        title="Task removed from Gantt schedule", message=f"{actor.name} removed a task from the project timeline.",
        notification_type="Schedule Deleted")
