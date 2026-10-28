from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.projects import service as project_service
from app.modules.projects.component_schema import ProjectComponentCreate, ProjectComponentUpdate
from app.modules.projects.model import ProjectComponent
from app.modules.tasks.model import Task, TaskActivity
from app.modules.users.model import User


def list_components(db: Session, project_id: UUID, actor: User) -> list[ProjectComponent]:
    project_service.get_project(db, project_id, actor)
    return db.query(ProjectComponent).filter(
        ProjectComponent.project_id == project_id,
        ProjectComponent.organization_id == actor.organization_id,
    ).order_by(func.lower(ProjectComponent.name), ProjectComponent.component_id).all()


def create_component(db: Session, project_id: UUID, payload: ProjectComponentCreate, actor: User) -> ProjectComponent:
    project_service.get_project(db, project_id, actor)
    name = payload.name.strip()
    exists = db.query(ProjectComponent.component_id).filter(
        ProjectComponent.project_id == project_id,
        ProjectComponent.organization_id == actor.organization_id,
        func.lower(ProjectComponent.name) == name.lower(),
    ).first()
    if exists:
        raise HTTPException(status_code=409, detail="A component with this name already exists in the project")
    component = ProjectComponent(project_id=project_id, name=name, description=payload.description)
    db.add(component)
    db.commit()
    db.refresh(component)
    return component


def update_component(db: Session, project_id: UUID, component_id: UUID, payload: ProjectComponentUpdate, actor: User) -> ProjectComponent:
    project_service.get_project(db, project_id, actor)
    component = db.query(ProjectComponent).filter(
        ProjectComponent.component_id == component_id,
        ProjectComponent.project_id == project_id,
        ProjectComponent.organization_id == actor.organization_id,
    ).one_or_none()
    if component is None:
        raise HTTPException(status_code=404, detail="Project component not found")
    values = payload.model_dump(exclude_unset=True)
    if "name" in values:
        name = values["name"].strip()
        duplicate = db.query(ProjectComponent.component_id).filter(
            ProjectComponent.project_id == project_id,
            ProjectComponent.organization_id == actor.organization_id,
            ProjectComponent.component_id != component_id,
            func.lower(ProjectComponent.name) == name.lower(),
        ).first()
        if duplicate:
            raise HTTPException(status_code=409, detail="A component with this name already exists in the project")
        values["name"] = name
    for field, value in values.items():
        setattr(component, field, value)
    db.commit()
    db.refresh(component)
    return component


def delete_component(db: Session, project_id: UUID, component_id: UUID, actor: User) -> None:
    project_service.get_project(db, project_id, actor)
    component = db.query(ProjectComponent).filter(
        ProjectComponent.component_id == component_id,
        ProjectComponent.project_id == project_id,
        ProjectComponent.organization_id == actor.organization_id,
    ).one_or_none()
    if component is None:
        raise HTTPException(status_code=404, detail="Project component not found")
    affected_tasks = db.query(Task).filter(
        Task.component_id == component_id,
        Task.project_id == project_id,
        Task.organization_id == actor.organization_id,
    ).all()
    for task in affected_tasks:
        task.component_id = None
        db.add(TaskActivity(
            task_id=task.task_id,
            actor_id=actor.user_id,
            event_type="COMPONENT_REMOVED",
            details=f"Removed component “{component.name}” from this task because the project component was deleted.",
        ))
    db.delete(component)
    db.commit()
