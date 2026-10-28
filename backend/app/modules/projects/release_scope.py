from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.projects.model import ProjectReleaseScopeChange


def record_release_scope_change(
    db: Session,
    *,
    organization_id: UUID,
    project_id: UUID,
    release_id: UUID,
    release_name: str,
    task_id: UUID | None,
    task_name: str,
    actor_id: UUID | None,
    event_type: str,
) -> None:
    db.add(ProjectReleaseScopeChange(
        organization_id=organization_id,
        project_id=project_id,
        release_id=release_id,
        release_name=release_name,
        task_id=task_id,
        task_name=task_name,
        actor_id=actor_id,
        event_type=event_type,
    ))
