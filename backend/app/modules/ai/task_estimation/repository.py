"""
==========================================================
                AI TASK ESTIMATION REPOSITORY
==========================================================

Data-access layer for the AITaskEstimation model.
"""

# ==========================================================
# Import Required Modules
# ==========================================================

from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.ai.task_estimation.model import AITaskEstimation
from app.modules.ai.task_estimation.schema import (
    AITaskEstimationCreate,
    AITaskEstimationUpdate,
)

def get_task_estimations(
    db: Session,
    skip: int = 0,
    limit: int = 100,
) -> list[AITaskEstimation]:

    return (
        db.query(AITaskEstimation)
        .order_by(AITaskEstimation.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )



# ==========================================================
# Create
# ==========================================================

def create_task_estimation(
    db: Session,
    payload: AITaskEstimationCreate,
) -> AITaskEstimation:

    task_estimation = AITaskEstimation(**payload.model_dump())

    db.add(task_estimation)
    db.commit()
    db.refresh(task_estimation)

    return task_estimation


# ==========================================================
# Read
# ==========================================================

def get_task_estimation(
    db: Session,
    estimation_id: UUID,
) -> AITaskEstimation | None:

    return db.get(AITaskEstimation, estimation_id)


def get_task_estimations_by_task(
    db: Session,
    task_id: UUID,
) -> list[AITaskEstimation]:

    return (
        db.query(AITaskEstimation)
        .filter(AITaskEstimation.task_id == task_id)
        .order_by(AITaskEstimation.created_at.desc())
        .all()
    )


def get_task_estimations_by_project(
    db: Session,
    project_id: UUID,
    skip: int = 0,
    limit: int = 100,
) -> list[AITaskEstimation]:

    return (
        db.query(AITaskEstimation)
        .filter(AITaskEstimation.project_id == project_id)
        .order_by(AITaskEstimation.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_latest_estimation_for_task(
    db: Session,
    task_id: UUID,
) -> AITaskEstimation | None:

    return (
        db.query(AITaskEstimation)
        .filter(AITaskEstimation.task_id == task_id)
        .order_by(AITaskEstimation.created_at.desc())
        .first()
    )


# ==========================================================
# Update
# ==========================================================

def update_task_estimation(
    db: Session,
    estimation_id: UUID,
    payload: AITaskEstimationUpdate,
) -> AITaskEstimation | None:

    task_estimation = db.get(AITaskEstimation, estimation_id)

    if task_estimation is None:
        return None

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task_estimation, field, value)

    db.commit()
    db.refresh(task_estimation)

    return task_estimation


# ==========================================================
# Delete
# ==========================================================

def delete_task_estimation(
    db: Session,
    estimation_id: UUID,
) -> bool:

    task_estimation = db.get(AITaskEstimation, estimation_id)

    if task_estimation is None:
        return False

    db.delete(task_estimation)
    db.commit()

    return True
