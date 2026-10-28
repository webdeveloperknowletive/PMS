from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.projects.model import ProjectTemplate
from app.modules.projects.template_schema import ProjectTemplateCreate
from app.modules.users.model import User


def list_templates(db: Session, user: User) -> list[ProjectTemplate]:
    return db.query(ProjectTemplate).filter(
        ProjectTemplate.organization_id == user.organization_id,
    ).order_by(ProjectTemplate.name.asc(), ProjectTemplate.created_at.asc()).all()


def create_template(db: Session, payload: ProjectTemplateCreate, user: User) -> ProjectTemplate:
    duplicate = db.query(ProjectTemplate.template_id).filter(
        ProjectTemplate.organization_id == user.organization_id,
        ProjectTemplate.name == payload.name,
    ).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="A template with this name already exists")
    row = ProjectTemplate(
        organization_id=user.organization_id,
        created_by=user.user_id,
        **payload.model_dump(),
    )
    db.add(row)
    try:
        db.commit()
        db.refresh(row)
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="A template with this name already exists") from error
    except Exception:
        db.rollback()
        raise
    return row


def delete_template(db: Session, template_id: UUID, user: User) -> None:
    row = db.query(ProjectTemplate).filter(
        ProjectTemplate.template_id == template_id,
        ProjectTemplate.organization_id == user.organization_id,
    ).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Project template not found")
    db.delete(row)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
