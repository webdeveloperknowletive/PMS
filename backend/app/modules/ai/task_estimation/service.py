from uuid import UUID

from fastapi import HTTPException, status
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
):
    """
    Get all AI task estimations.
    """
    return (
        db.query(AITaskEstimation)
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_task_estimation(
    db: Session,
    estimation_id: UUID,
):
    """
    Get AI task estimation by ID.
    """
    estimation = db.get(
        AITaskEstimation,
        estimation_id,
    )

    if estimation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task estimation not found",
        )

    return estimation


def generate_task_estimation(
    db: Session,
    payload: AITaskEstimationCreate,
):
    """
    Generate a new AI task estimation.
    """
    estimation = AITaskEstimation(
        **payload.model_dump()
    )

    db.add(estimation)
    db.commit()
    db.refresh(estimation)

    return estimation


def update_task_estimation(
    db: Session,
    estimation_id: UUID,
    payload: AITaskEstimationUpdate,
):
    """
    Update an existing AI task estimation.
    """
    estimation = db.get(
        AITaskEstimation,
        estimation_id,
    )

    if estimation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task estimation not found",
        )

    for field, value in payload.model_dump(
        exclude_unset=True
    ).items():
        setattr(estimation, field, value)

    db.commit()
    db.refresh(estimation)

    return estimation


def delete_task_estimation(
    db: Session,
    estimation_id: UUID,
):
    """
    Delete an AI task estimation.
    """
    estimation = db.get(
        AITaskEstimation,
        estimation_id,
    )

    if estimation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task estimation not found",
        )

    db.delete(estimation)
    db.commit()

    return None