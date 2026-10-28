from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.projects import service as project_service
from app.modules.projects.model import ProjectRelease, ProjectReleaseScopeChange
from app.modules.projects.release_schema import ProjectReleaseCreate, ProjectReleaseUpdate
from app.modules.projects.release_scope import record_release_scope_change
from app.modules.tasks.model import Task, TaskActivity
from app.modules.users.model import User


def _read(db: Session, release: ProjectRelease) -> dict:
    task_count, completed, unresolved = db.query(
        func.count(Task.task_id),
        func.count(Task.task_id).filter(Task.status == "DONE"),
        func.count(Task.task_id).filter(Task.status.notin_(("DONE", "CANCELLED"))),
    ).filter(
        Task.release_id == release.release_id,
        Task.project_id == release.project_id,
        Task.organization_id == release.organization_id,
    ).one()
    return {**{field: getattr(release, field) for field in (
        "release_id", "project_id", "name", "version", "status", "release_date", "notes", "created_at", "updated_at",
    )}, "task_count": task_count, "completed_task_count": completed, "unresolved_task_count": unresolved}


def list_releases(db: Session, project_id: UUID, user: User) -> list[dict]:
    project_service.get_project(db, project_id, user)
    rows = db.query(ProjectRelease).filter(
        ProjectRelease.project_id == project_id,
        ProjectRelease.organization_id == user.organization_id,
    ).order_by(ProjectRelease.release_date.asc().nullslast(), ProjectRelease.created_at.asc()).all()
    return [_read(db, row) for row in rows]


def create_release(db: Session, project_id: UUID, payload: ProjectReleaseCreate, user: User) -> dict:
    project = project_service.get_project(db, project_id, user)
    row = ProjectRelease(project_id=project_id, organization_id=project.organization_id, **payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return _read(db, row)


def update_release(db: Session, project_id: UUID, release_id: UUID, payload: ProjectReleaseUpdate, user: User) -> dict:
    project_service.get_project(db, project_id, user)
    row = db.query(ProjectRelease).filter(
        ProjectRelease.release_id == release_id,
        ProjectRelease.project_id == project_id,
        ProjectRelease.organization_id == user.organization_id,
    ).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Release not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return _read(db, row)


def delete_release(db: Session, project_id: UUID, release_id: UUID, user: User) -> None:
    project_service.get_project(db, project_id, user)
    row = db.query(ProjectRelease).filter(
        ProjectRelease.release_id == release_id,
        ProjectRelease.project_id == project_id,
        ProjectRelease.organization_id == user.organization_id,
    ).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Release not found")
    linked_tasks = db.query(Task).filter(
        Task.organization_id == user.organization_id,
        Task.project_id == project_id,
        Task.release_id == release_id,
    ).all()
    for task in linked_tasks:
        record_release_scope_change(
            db, organization_id=user.organization_id, project_id=project_id,
            release_id=release_id, release_name=row.name, task_id=task.task_id,
            task_name=task.task_name, actor_id=user.user_id, event_type="REMOVED",
        )
        db.add(TaskActivity(
            task_id=task.task_id, organization_id=user.organization_id,
            actor_id=user.user_id, event_type="RELEASE_REMOVED",
            details=f"Removed from release {row.name} because that release was deleted.",
        ))
        task.release_id = None
    db.delete(row)
    db.commit()


def list_release_scope_history(
    db: Session,
    project_id: UUID,
    release_id: UUID | None,
    user: User,
    limit: int = 100,
) -> list[dict]:
    project_service.get_project(db, project_id, user)
    query = db.query(ProjectReleaseScopeChange, User.name).outerjoin(
        User,
        (User.user_id == ProjectReleaseScopeChange.actor_id)
        & (User.organization_id == ProjectReleaseScopeChange.organization_id),
    ).filter(
        ProjectReleaseScopeChange.organization_id == user.organization_id,
        ProjectReleaseScopeChange.project_id == project_id,
    )
    if release_id is not None:
        query = query.filter(ProjectReleaseScopeChange.release_id == release_id)
    rows = query.order_by(
        ProjectReleaseScopeChange.created_at.desc(),
        ProjectReleaseScopeChange.scope_change_id.desc(),
    ).limit(limit).all()
    fields = (
        "scope_change_id", "project_id", "release_id", "release_name", "task_id",
        "task_name", "actor_id", "event_type", "created_at",
    )
    return [{**{field: getattr(change, field) for field in fields}, "actor_name": actor_name} for change, actor_name in rows]
