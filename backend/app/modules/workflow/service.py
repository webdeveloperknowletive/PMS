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


def get_workflows(db: Session, skip: int = 0, limit: int = 100) -> list[Workflow]:
    """Get all workflows (paginated)."""
    return repository.get_workflows(db, skip=skip, limit=limit)


def get_workflow(db: Session, workflow_id: UUID) -> Workflow:
    """Get a single workflow by ID, or raise 404."""
    workflow = repository.get_workflow(db, workflow_id)
    if workflow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")
    return workflow


def create_workflow(db: Session, payload: WorkflowCreate) -> Workflow:
    """Create a new workflow."""
    return repository.create_workflow(db, payload)


def update_workflow(db: Session, workflow_id: UUID, payload: WorkflowUpdate) -> Workflow:
    """Update an existing workflow, or raise 404."""
    workflow = repository.update_workflow(db, workflow_id, payload)
    if workflow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")
    return workflow


def delete_workflow(db: Session, workflow_id: UUID) -> None:
    """Delete a workflow, or raise 404."""
    deleted = repository.delete_workflow(db, workflow_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")
