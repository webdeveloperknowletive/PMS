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
from app.modules.users.model import User


def get_gantt_tasks(db: Session, skip: int = 0, limit: int = 100) -> list[GanttTask]:
    """Get all gantt tasks (paginated)."""
    return repository.get_gantt_tasks(db, skip=skip, limit=limit)


def get_gantt_task(db: Session, gantt_id: UUID) -> GanttTask:
    """Get a single gantt task by ID, or raise 404."""
    gantt_task = repository.get_gantt_task(db, gantt_id)
    if gantt_task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gantt task not found")
    return gantt_task


def create_gantt_task(db: Session, payload: GanttTaskCreate, actor: User) -> GanttTask:
    """Create a new gantt task."""
    entry = repository.create_gantt_task(db, payload)
    notify_project_users(db, entry.project_id, actor_id=actor.user_id,
        title="Task added to Gantt schedule", message=f"{actor.name} scheduled a task on the project timeline.",
        notification_type="Schedule Created")
    return entry


def update_gantt_task(db: Session, gantt_id: UUID, payload: GanttTaskUpdate, actor: User) -> GanttTask:
    """Update an existing gantt task, or raise 404."""
    gantt_task = repository.update_gantt_task(db, gantt_id, payload)
    if gantt_task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gantt task not found")
    notify_project_users(db, gantt_task.project_id, actor_id=actor.user_id,
        title="Gantt schedule updated", message=f"{actor.name} updated a task on the project timeline.",
        notification_type="Schedule Updated")
    return gantt_task


def delete_gantt_task(db: Session, gantt_id: UUID, actor: User) -> None:
    """Delete a gantt task, or raise 404."""
    entry = get_gantt_task(db, gantt_id)
    project_id = entry.project_id
    deleted = repository.delete_gantt_task(db, gantt_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gantt task not found")
    notify_project_users(db, project_id, actor_id=actor.user_id,
        title="Task removed from Gantt schedule", message=f"{actor.name} removed a task from the project timeline.",
        notification_type="Schedule Deleted")
