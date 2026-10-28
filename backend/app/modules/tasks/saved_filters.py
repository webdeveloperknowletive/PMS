from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.modules.tasks.model import SavedTaskFilter
from app.modules.tasks.schema import SavedTaskFilterCreate
from app.modules.projects.model import ProjectComponent, ProjectRelease
from app.modules.projects import service as project_service
from app.modules.users.model import User
from app.core.permissions import has_permission


def _read_filter(saved_filter: SavedTaskFilter) -> dict:
    return {
        "filter_id": saved_filter.filter_id,
        "user_id": saved_filter.user_id,
        "name": saved_filter.name,
        "search": saved_filter.search,
        "project_id": saved_filter.project_id,
        "assignee_id": saved_filter.assignee_id,
        "label": saved_filter.label,
        "component_id": saved_filter.component_id,
        "release_id": saved_filter.release_id,
        "status": saved_filter.task_status,
        "priority": saved_filter.priority,
        "overdue": saved_filter.overdue,
        "is_shared": saved_filter.is_shared,
        "created_at": saved_filter.created_at,
        "updated_at": saved_filter.updated_at,
    }


def list_saved_filters(db: Session, user: User) -> list[dict]:
    rows = db.query(SavedTaskFilter).filter(
        SavedTaskFilter.organization_id == user.organization_id,
        or_(SavedTaskFilter.user_id == user.user_id, SavedTaskFilter.is_shared.is_(True)),
    ).order_by(SavedTaskFilter.name).all()
    return [_read_filter(row) for row in rows]


def create_saved_filter(db: Session, payload: SavedTaskFilterCreate, user: User) -> dict:
    if payload.is_shared and not has_permission(db, user, "tasks.manage"):
        raise HTTPException(status_code=403, detail="Only task managers can share filters with the workspace")
    if payload.project_id is not None:
        project_service.get_project(db, payload.project_id, user)
    if payload.component_id is not None:
        if payload.project_id is None or db.query(ProjectComponent.component_id).filter(
            ProjectComponent.component_id == payload.component_id,
            ProjectComponent.project_id == payload.project_id,
            ProjectComponent.organization_id == user.organization_id,
        ).one_or_none() is None:
            raise HTTPException(status_code=400, detail="Choose a component from the selected project")
    if payload.release_id is not None:
        if payload.project_id is None or db.query(ProjectRelease.release_id).filter(
            ProjectRelease.release_id == payload.release_id,
            ProjectRelease.project_id == payload.project_id,
            ProjectRelease.organization_id == user.organization_id,
        ).one_or_none() is None:
            raise HTTPException(status_code=400, detail="Choose a release from the selected project")
    saved_filter = SavedTaskFilter(
        organization_id=user.organization_id,
        user_id=user.user_id,
        name=payload.name,
        search=payload.search or None,
        project_id=payload.project_id,
        assignee_id=payload.assignee_id,
        label=payload.label.casefold() if payload.label else None,
        component_id=payload.component_id,
        release_id=payload.release_id,
        task_status=payload.status,
        priority=payload.priority,
        overdue=payload.overdue,
        is_shared=payload.is_shared,
    )
    db.add(saved_filter)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="A saved filter with this name already exists") from error
    db.refresh(saved_filter)
    return _read_filter(saved_filter)


def delete_saved_filter(db: Session, filter_id: UUID, user: User) -> None:
    saved_filter = db.query(SavedTaskFilter).filter(
        SavedTaskFilter.filter_id == filter_id,
        SavedTaskFilter.user_id == user.user_id,
    ).one_or_none()
    if saved_filter is None:
        raise HTTPException(status_code=404, detail="Saved filter not found")
    db.delete(saved_filter)
    db.commit()
