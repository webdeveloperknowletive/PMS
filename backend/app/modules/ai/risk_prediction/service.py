"""
==========================================================
                AI RISK PREDICTION SERVICE
==========================================================

Business logic layer for AI risk predictions. See the note
in ai/doc_generator/service.py — this module stores results,
it does not call an LLM itself.
"""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.ai.risk_prediction import repository
from app.modules.ai.risk_prediction.model import AIRiskPrediction
from app.modules.ai.risk_prediction.schema import AIRiskPredictionCreate, AIRiskPredictionUpdate


def get_risk_predictions(db: Session, skip: int = 0, limit: int = 100) -> list[AIRiskPrediction]:
    return repository.get_risk_predictions(db, skip=skip, limit=limit)


def get_risk_prediction(db: Session, prediction_id: UUID) -> AIRiskPrediction:
    prediction = repository.get_risk_prediction(db, prediction_id)
    if prediction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Risk prediction not found")
    return prediction


def generate_risk_prediction(db: Session, payload: AIRiskPredictionCreate) -> AIRiskPrediction:
    return repository.create_risk_prediction(db, payload)


def update_risk_prediction(db: Session, prediction_id: UUID, payload: AIRiskPredictionUpdate) -> AIRiskPrediction:
    prediction = repository.update_risk_prediction(db, prediction_id, payload)
    if prediction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Risk prediction not found")
    return prediction


def delete_risk_prediction(db: Session, prediction_id: UUID) -> None:
    deleted = repository.delete_risk_prediction(db, prediction_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Risk prediction not found")
