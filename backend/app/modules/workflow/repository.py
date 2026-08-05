"""
==========================================================
                WORKFLOW REPOSITORY
==========================================================

Data-access layer for the Workflow model.
"""

# ==========================================================
# Import Required Modules
# ==========================================================

from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.workflow.model import Workflow
from app.modules.workflow.schema import WorkflowCreate, WorkflowUpdate


# ==========================================================
# Create
# ==========================================================

def create_workflow(
    db: Session,
    payload: WorkflowCreate,
) -> Workflow:

    workflow = Workflow(**payload.model_dump())

    db.add(workflow)
    db.commit()
    db.refresh(workflow)

    return workflow


# ==========================================================
# Read
# ==========================================================

def get_workflow(
    db: Session,
    workflow_id: UUID,
) -> Workflow | None:

    return db.get(Workflow, workflow_id)


def get_workflows_by_project(
    db: Session,
    project_id: UUID,
    skip: int = 0,
    limit: int = 100,
) -> list[Workflow]:

    return (
        db.query(Workflow)
        .filter(Workflow.project_id == project_id)
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_workflows_by_team_lead(
    db: Session,
    team_lead_id: UUID,
) -> list[Workflow]:

    return (
        db.query(Workflow)
        .filter(Workflow.team_lead_id == team_lead_id)
        .all()
    )


def get_default_workflow(
    db: Session,
    project_id: UUID,
) -> Workflow | None:

    return (
        db.query(Workflow)
        .filter(
            Workflow.project_id == project_id,
            Workflow.is_default.is_(True),
        )
        .first()
    )


# ==========================================================
# Update
# ==========================================================

def update_workflow(
    db: Session,
    workflow_id: UUID,
    payload: WorkflowUpdate,
) -> Workflow | None:

    workflow = db.get(Workflow, workflow_id)

    if workflow is None:
        return None

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(workflow, field, value)

    db.commit()
    db.refresh(workflow)

    return workflow


# ==========================================================
# Delete
# ==========================================================

def delete_workflow(
    db: Session,
    workflow_id: UUID,
) -> bool:

    workflow = db.get(Workflow, workflow_id)

    if workflow is None:
        return False

    db.delete(workflow)
    db.commit()

    return True
