"""
==========================================================
                WORKFLOW SERVICE
==========================================================

Business logic layer for Workflows. Orchestrates calls to
repository.py and translates "not found" into HTTP errors.
Routers should only ever call this layer, never the model
or repository directly.
"""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.workflow import repository
from app.modules.workflow.model import Workflow
from app.modules.workflow.schema import WorkflowCreate, WorkflowUpdate
from app.modules.notifications.events import notify_project_users
from app.modules.users.model import User
from app.modules.calendar.automatic import add_automatic_calendar_entries


def get_workflows(db: Session, skip: int = 0, limit: int = 100) -> list[Workflow]:
    """Get all workflows (paginated)."""
    return repository.get_workflows(db, skip=skip, limit=limit)


def get_workflow(db: Session, workflow_id: UUID) -> Workflow:
    """Get a single workflow by ID, or raise 404."""
    workflow = repository.get_workflow(db, workflow_id)
    if workflow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")
    return workflow


def create_workflow(db: Session, payload: WorkflowCreate, actor: User) -> Workflow:
    """Create a new workflow."""
    workflow = repository.create_workflow(db, payload)
    add_automatic_calendar_entries(
        db, project_id=workflow.project_id, actor_id=actor.user_id,
        title=f"Workflow created: {workflow.workflow_name}",
        description=f"{actor.name} created a project workflow.", event_type="Work activity",
    )
    db.commit()
    notify_project_users(db, workflow.project_id, actor_id=actor.user_id,
        title=f"Workflow created: {workflow.workflow_name}", message=f"{actor.name} created a project workflow.",
        notification_type="Workflow Created")
    return workflow


def update_workflow(db: Session, workflow_id: UUID, payload: WorkflowUpdate, actor: User) -> Workflow:
    """Update an existing workflow, or raise 404."""
    workflow = repository.update_workflow(db, workflow_id, payload)
    if workflow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")
    add_automatic_calendar_entries(
        db, project_id=workflow.project_id, actor_id=actor.user_id,
        title=f"Workflow updated: {workflow.workflow_name}",
        description=f"{actor.name} updated a project workflow.", event_type="Work activity",
    )
    db.commit()
    notify_project_users(db, workflow.project_id, actor_id=actor.user_id,
        title=f"Workflow updated: {workflow.workflow_name}", message=f"{actor.name} updated the project workflow.",
        notification_type="Workflow Updated")
    return workflow


def delete_workflow(db: Session, workflow_id: UUID, actor: User) -> None:
    """Delete a workflow, or raise 404."""
    workflow = get_workflow(db, workflow_id)
    project_id, workflow_name = workflow.project_id, workflow.workflow_name
    add_automatic_calendar_entries(
        db, project_id=project_id, actor_id=actor.user_id,
        title=f"Workflow deleted: {workflow_name}",
        description=f"{actor.name} deleted a project workflow.", event_type="Work activity",
    )
    deleted = repository.delete_workflow(db, workflow_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")
    notify_project_users(db, project_id, actor_id=actor.user_id,
        title=f"Workflow deleted: {workflow_name}", message=f"{actor.name} deleted the project workflow.",
        notification_type="Workflow Deleted")
