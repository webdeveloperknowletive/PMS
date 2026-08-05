from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.projects.model import Project
from app.modules.projects.schema import (
    ProjectCreate,
    ProjectUpdate,
)


def get_projects(
    db: Session,
    skip: int = 0,
    limit: int = 100,
):
    """
    Get all projects.
    """
    return (
        db.query(Project)
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_project(
    db: Session,
    project_id: UUID,
):
    """
    Get a project by ID.
    """
    project = db.get(
        Project,
        project_id,
    )

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    return project


def create_project(
    db: Session,
    payload: ProjectCreate,
):
    """
    Create a new project.
    """
    project = Project(
        **payload.model_dump()
    )

    db.add(project)
    db.commit()
    db.refresh(project)

    return project


def update_project(
    db: Session,
    project_id: UUID,
    payload: ProjectUpdate,
):
    """
    Update an existing project.
    """
    project = db.get(
        Project,
        project_id,
    )

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    for field, value in payload.model_dump(
        exclude_unset=True
    ).items():
        setattr(
            project,
            field,
            value,
        )

    db.commit()
    db.refresh(project)

    return project


def delete_project(
    db: Session,
    project_id: UUID,
):
    """
    Delete a project.
    """
    project = db.get(
        Project,
        project_id,
    )

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    db.delete(project)
    db.commit()

    return None