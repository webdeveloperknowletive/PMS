"""
==========================================================
                PROJECTS SERVICE
==========================================================

Business logic layer for Projects. Orchestrates calls to
repository.py and translates "not found" into HTTP errors.
Routers should only ever call this layer, never the model
or repository directly.
"""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.projects import repository
from app.modules.projects.model import Project
from app.modules.projects.schema import ProjectCreate, ProjectUpdate
from app.modules.notifications.events import notify_users, project_recipient_ids, users_with_permissions
from app.modules.users.model import User


def get_projects(db: Session, skip: int = 0, limit: int = 100) -> list[Project]:
    """Get all projects (paginated)."""
    return repository.get_projects(db, skip=skip, limit=limit)


def get_project(db: Session, project_id: UUID) -> Project:
    """Get a single project by ID, or raise 404."""
    project = repository.get_project(db, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def create_project(db: Session, payload: ProjectCreate, actor: User) -> Project:
    """Create a new project."""
    project = repository.create_project(db, payload)
    notify_users(
        db, users_with_permissions(db, "projects.manage"), actor_id=actor.user_id,
        project_id=project.project_id, title=f"Project created: {project.project_name}",
        message=f"{actor.name} created a project.", notification_type="Project Created",
    )
    return project


def update_project(db: Session, project_id: UUID, payload: ProjectUpdate, actor: User) -> Project:
    """Update an existing project, or raise 404."""
    project = repository.update_project(db, project_id, payload)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    notify_users(
        db, project_recipient_ids(db, project_id), actor_id=actor.user_id,
        project_id=project_id, title=f"Project updated: {project.project_name}",
        message=f"{actor.name} updated the project details.", notification_type="Project Updated",
    )
    return project


def delete_project(db: Session, project_id: UUID, actor: User) -> None:
    """Delete a project, or raise 404."""
    project = get_project(db, project_id)
    project_name = project.project_name
    recipients = project_recipient_ids(db, project_id)
    deleted = repository.delete_project(db, project_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    notify_users(
        db, recipients, actor_id=actor.user_id, project_id=None,
        title=f"Project deleted: {project_name}",
        message=f"{actor.name} deleted this project.", notification_type="Project Deleted",
    )
