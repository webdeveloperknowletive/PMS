"""
==========================================================
                AI RISK PREDICTION REPOSITORY
==========================================================

Data-access layer for the AIRiskPrediction model.
"""

# ==========================================================
# Import Required Modules
# ==========================================================

from uuid import UUID

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
) -> list[AIRiskPrediction]:

    return (
        db.query(AIRiskPrediction)
        .order_by(AIRiskPrediction.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )



# ==========================================================
# Create
# ==========================================================

def create_risk_prediction(
    db: Session,
    payload: AIRiskPredictionCreate,
) -> AIRiskPrediction:

    risk_prediction = AIRiskPrediction(**payload.model_dump())

    db.add(risk_prediction)
    db.commit()
    db.refresh(risk_prediction)

    return risk_prediction


# ==========================================================
# Read
# ==========================================================

def get_risk_prediction(
    db: Session,
    prediction_id: UUID,
) -> AIRiskPrediction | None:

    return db.get(AIRiskPrediction, prediction_id)


def get_risk_predictions_by_project(
    db: Session,
    project_id: UUID,
    skip: int = 0,
    limit: int = 100,
) -> list[AIRiskPrediction]:

    return (
        db.query(AIRiskPrediction)
        .filter(AIRiskPrediction.project_id == project_id)
        .order_by(AIRiskPrediction.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_risk_predictions_by_task(
    db: Session,
    task_id: UUID,
) -> list[AIRiskPrediction]:

    return (
        db.query(AIRiskPrediction)
        .filter(AIRiskPrediction.task_id == task_id)
        .all()
    )


def get_risk_predictions_by_level(
    db: Session,
    project_id: UUID,
    risk_level: str,
) -> list[AIRiskPrediction]:

    return (
        db.query(AIRiskPrediction)
        .filter(
            AIRiskPrediction.project_id == project_id,
            AIRiskPrediction.risk_level == risk_level,
        )
        .all()
    )


# ==========================================================
# Update
# ==========================================================

def update_risk_prediction(
    db: Session,
    prediction_id: UUID,
    payload: AIRiskPredictionUpdate,
) -> AIRiskPrediction | None:

    risk_prediction = db.get(AIRiskPrediction, prediction_id)

    if risk_prediction is None:
        return None

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(risk_prediction, field, value)

    db.commit()
    db.refresh(risk_prediction)

    return risk_prediction


# ==========================================================
# Delete
# ==========================================================

def delete_risk_prediction(
    db: Session,
    prediction_id: UUID,
) -> bool:

    risk_prediction = db.get(AIRiskPrediction, prediction_id)

    if risk_prediction is None:
        return False

    db.delete(risk_prediction)
    db.commit()

    return True
