from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.projects import service as project_service
from app.modules.projects.custom_field_schema import ProjectCustomFieldCreate
from app.modules.projects.model import ProjectCustomField
from app.modules.tasks.model import Task, TaskActivity
from app.modules.users.model import User

MAX_CUSTOM_FIELDS_PER_PROJECT = 25


def list_fields(db: Session, project_id: UUID, actor: User) -> list[ProjectCustomField]:
    project_service.get_project(db, project_id, actor)
    return db.query(ProjectCustomField).filter(
        ProjectCustomField.project_id == project_id,
        ProjectCustomField.organization_id == actor.organization_id,
    ).order_by(func.lower(ProjectCustomField.name), ProjectCustomField.field_id).all()


def create_field(db: Session, project_id: UUID, payload: ProjectCustomFieldCreate, actor: User) -> ProjectCustomField:
    project = project_service.get_project(db, project_id, actor)
    current_count = db.query(func.count(ProjectCustomField.field_id)).filter(
        ProjectCustomField.project_id == project_id,
        ProjectCustomField.organization_id == actor.organization_id,
    ).scalar() or 0
    if current_count >= MAX_CUSTOM_FIELDS_PER_PROJECT:
        raise HTTPException(status_code=400, detail=f"Projects can have at most {MAX_CUSTOM_FIELDS_PER_PROJECT} custom fields")
    duplicate = db.query(ProjectCustomField.field_id).filter(
        ProjectCustomField.project_id == project_id,
        ProjectCustomField.organization_id == actor.organization_id,
        func.lower(ProjectCustomField.name) == payload.name.lower(),
    ).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="A custom field with this name already exists in the project")
    field = ProjectCustomField(
        project_id=project_id,
        organization_id=project.organization_id,
        name=payload.name,
        field_type=payload.field_type,
        is_required=payload.is_required,
        options=payload.options,
        default_value=payload.default_value,
    )
    db.add(field)
    db.commit()
    db.refresh(field)
    return field


def delete_field(db: Session, project_id: UUID, field_id: UUID, actor: User) -> None:
    project_service.get_project(db, project_id, actor)
    field = db.query(ProjectCustomField).filter(
        ProjectCustomField.field_id == field_id,
        ProjectCustomField.project_id == project_id,
        ProjectCustomField.organization_id == actor.organization_id,
    ).one_or_none()
    if field is None:
        raise HTTPException(status_code=404, detail="Project custom field not found")

    tasks = db.query(Task).filter(
        Task.project_id == project_id,
        Task.organization_id == actor.organization_id,
    ).all()
    for task in tasks:
        values = dict(task.custom_fields or {})
        if str(field_id) not in values:
            continue
        values.pop(str(field_id), None)
        task.custom_fields = values
        db.add(TaskActivity(
            task_id=task.task_id,
            actor_id=actor.user_id,
            event_type="CUSTOM_FIELD_CLEARED",
            details=f"Cleared the “{field.name}” custom field because the project field was removed.",
        ))
    db.delete(field)
    db.commit()
