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

def get_workflows(
    db: Session,
    skip: int = 0,
    limit: int = 100,
) -> list[Workflow]:

    return (
        db.query(Workflow)
        .order_by(Workflow.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )



# ==========================================================
# Create
# ==========================================================

def create_workflow(
    db: Session,
    payload: WorkflowCreate,
) -> Workflow:

    if payload.is_default:
        db.query(Workflow).filter(
            Workflow.project_id == payload.project_id,
            Workflow.is_default.is_(True),
        ).update({Workflow.is_default: False}, synchronize_session=False)

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
        .order_by(Workflow.created_at, Workflow.workflow_id)
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

    changes = payload.model_dump(exclude_unset=True)
    if changes.get("is_default") is True:
        db.query(Workflow).filter(
            Workflow.project_id == workflow.project_id,
            Workflow.workflow_id != workflow.workflow_id,
            Workflow.is_default.is_(True),
        ).update({Workflow.is_default: False}, synchronize_session=False)
    for field, value in changes.items():
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
