from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.workflow.model import Workflow
from app.modules.workflow.schema import (
    WorkflowCreate,
    WorkflowUpdate,
)


def get_workflows(
    db: Session,
    skip: int = 0,
    limit: int = 100,
):
    """
    Get all workflows.
    """
    return (
        db.query(Workflow)
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_workflow(
    db: Session,
    workflow_id: UUID,
):
    """
    Get workflow by ID.
    """
    workflow = db.get(
        Workflow,
        workflow_id,
    )

    if workflow is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found",
        )

    return workflow


def create_workflow(
    db: Session,
    payload: WorkflowCreate,
):
    """
    Create a new workflow.
    """
    workflow = Workflow(
        **payload.model_dump()
    )

    db.add(workflow)
    db.commit()
    db.refresh(workflow)

    return workflow


def update_workflow(
    db: Session,
    workflow_id: UUID,
    payload: WorkflowUpdate,
):
    """
    Update an existing workflow.
    """
    workflow = db.get(
        Workflow,
        workflow_id,
    )

    if workflow is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found",
        )

    for field, value in payload.model_dump(
        exclude_unset=True,
    ).items():
        setattr(
            workflow,
            field,
            value,
        )

    db.commit()
    db.refresh(workflow)

    return workflow


def delete_workflow(
    db: Session,
    workflow_id: UUID,
):
    """
    Delete a workflow.
    """
    workflow = db.get(
        Workflow,
        workflow_id,
    )

    if workflow is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found",
        )

    db.delete(workflow)
    db.commit()

    return None
