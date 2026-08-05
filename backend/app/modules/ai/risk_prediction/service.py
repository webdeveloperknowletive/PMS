from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.ai.risk_prediction.model import AIRiskPrediction
from app.modules.ai.risk_prediction.schema import (
    AIRiskPredictionCreate,
    AIRiskPredictionUpdate,
)


def get_risk_predictions(
    db: Session,
    skip: int = 0,
    limit: int = 100,
):
    """
    Get all AI risk predictions.
    """
    return (
        db.query(AIRiskPrediction)
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_risk_prediction(
    db: Session,
    prediction_id: UUID,
):
    """
    Get AI risk prediction by ID.
    """
    prediction = db.get(
        AIRiskPrediction,
        prediction_id,
    )

    if prediction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Risk prediction not found",
        )

    return prediction


def generate_risk_prediction(
    db: Session,
    payload: AIRiskPredictionCreate,
):
    """
    Generate a new AI risk prediction.
    """
    prediction = AIRiskPrediction(
        **payload.model_dump()
    )

    db.add(prediction)
    db.commit()
    db.refresh(prediction)

    return prediction


def update_risk_prediction(
    db: Session,
    prediction_id: UUID,
    payload: AIRiskPredictionUpdate,
):
    """
    Update an existing AI risk prediction.
    """
    prediction = db.get(
        AIRiskPrediction,
        prediction_id,
    )

    if prediction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Risk prediction not found",
        )

    for field, value in payload.model_dump(
        exclude_unset=True
    ).items():
        setattr(prediction, field, value)

    db.commit()
    db.refresh(prediction)

    return prediction


def delete_risk_prediction(
    db: Session,
    prediction_id: UUID,
):
    """
    Delete an AI risk prediction.
    """
    prediction = db.get(
        AIRiskPrediction,
        prediction_id,
    )

    if prediction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Risk prediction not found",
        )

    db.delete(prediction)
    db.commit()

    return None