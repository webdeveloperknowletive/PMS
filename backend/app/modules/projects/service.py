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


def get_projects(db: Session, skip: int = 0, limit: int = 100) -> list[Project]:
    """Get all projects (paginated)."""
    return repository.get_projects(db, skip=skip, limit=limit)


def get_project(db: Session, project_id: UUID) -> Project:
    """Get a single project by ID, or raise 404."""
    project = repository.get_project(db, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def create_project(db: Session, payload: ProjectCreate) -> Project:
    """Create a new project."""
    return repository.create_project(db, payload)


def update_project(db: Session, project_id: UUID, payload: ProjectUpdate) -> Project:
    """Update an existing project, or raise 404."""
    project = repository.update_project(db, project_id, payload)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def delete_project(db: Session, project_id: UUID) -> None:
    """Delete a project, or raise 404."""
    deleted = repository.delete_project(db, project_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
