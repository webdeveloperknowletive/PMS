"""
==========================================================
                PROJECTS REPOSITORY
==========================================================

Data-access layer for the Project model.

Encapsulates all direct database queries for projects so
that the service/router layers never touch the ORM
directly.
"""

# ==========================================================
# Import Required Modules
# ==========================================================

from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.projects.model import Project
from app.modules.projects.schema import ProjectCreate, ProjectUpdate


# ==========================================================
# Create
# ==========================================================

def create_project(
    db: Session,
    payload: ProjectCreate,
) -> Project:

    project = Project(**payload.model_dump())

    db.add(project)
    db.commit()
    db.refresh(project)

    return project


# ==========================================================
# Read
# ==========================================================

def get_project(
    db: Session,
    project_id: UUID,
) -> Project | None:

    return db.get(Project, project_id)


def get_project_by_name(
    db: Session,
    project_name: str,
) -> Project | None:

    return (
        db.query(Project)
        .filter(Project.project_name == project_name)
        .first()
    )


def get_projects(
    db: Session,
    skip: int = 0,
    limit: int = 100,
) -> list[Project]:

    return (
        db.query(Project)
        .order_by(Project.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_projects_by_status(
    db: Session,
    status: str,
    skip: int = 0,
    limit: int = 100,
) -> list[Project]:

    return (
        db.query(Project)
        .filter(Project.status == status)
        .order_by(Project.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def count_projects(
    db: Session,
) -> int:

    return db.query(Project).count()


# ==========================================================
# Update
# ==========================================================

def update_project(
    db: Session,
    project_id: UUID,
    payload: ProjectUpdate,
) -> Project | None:

    project = db.get(Project, project_id)

    if project is None:
        return None

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(project, field, value)

    db.commit()
    db.refresh(project)

    return project


# ==========================================================
# Delete
# ==========================================================

def delete_project(
    db: Session,
    project_id: UUID,
) -> bool:

    project = db.get(Project, project_id)

    if project is None:
        return False

    db.delete(project)
    db.commit()

    return True
