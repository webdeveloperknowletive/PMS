"""
==========================================================
                AI RISK PREDICTION SERVICE
==========================================================

Business logic layer for AI risk predictions. See the note
in ai/doc_generator/service.py — this module stores results,
it does not call an LLM itself.
"""

from uuid import UUID
from typing import Any

from fastapi import HTTPException, status
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.orm import Session

from app.core.config import GROQ_MODEL
from app.modules.ai.generation import generate_structured
from app.modules.ai.risk_prediction import repository
from app.modules.ai.risk_prediction.model import AIRiskPrediction
from app.modules.ai.risk_prediction.schema import AIRiskPredictionCreate, AIRiskPredictionGenerationRequest, AIRiskPredictionUpdate
from app.modules.projects.model import Project
from app.modules.tasks.model import Task


class _RiskOutput(BaseModel):
    risk_type: str
    risk_level: str
    probability: float = Field(..., ge=0, le=100)
    impact: str | None = None
    recommendation: str
    confidence_score: float | None = Field(None, ge=0, le=100)
    factors: list[Any] = Field(default_factory=list)


def get_risk_predictions(db: Session, skip: int = 0, limit: int = 100) -> list[AIRiskPrediction]:
    return repository.get_risk_predictions(db, skip=skip, limit=limit)


def get_risk_prediction(db: Session, prediction_id: UUID) -> AIRiskPrediction:
    prediction = repository.get_risk_prediction(db, prediction_id)
    if prediction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Risk prediction not found")
    return prediction


def generate_risk_prediction(db: Session, payload: AIRiskPredictionCreate) -> AIRiskPrediction:
    return repository.create_risk_prediction(db, payload)


def generate_risk_prediction_with_ai(db: Session, payload: AIRiskPredictionGenerationRequest) -> AIRiskPrediction:
    project = db.get(Project, payload.project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    tasks_query = db.query(Task).filter(Task.project_id == payload.project_id)
    if payload.task_id:
        tasks_query = tasks_query.filter(Task.task_id == payload.task_id)
    tasks = tasks_query.order_by(Task.due_date.asc().nullslast()).limit(40).all()
    if payload.task_id and not tasks:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found in this project")
    context = [{"name": task.task_name, "description": task.description, "status": task.status,
                "priority": task.priority, "due_date": str(task.due_date) if task.due_date else None}
               for task in tasks]
    user_prompt = f"Project: {project.project_name}\nDescription: {project.description or 'Not provided'}\nTasks: {context}\nRequest: {payload.prompt}"
    raw = generate_structured(
        "Assess delivery risks based only on supplied project facts. Return JSON with risk_type, risk_level (Low, Medium, High), "
        "probability (0 to 100), impact, recommendation, confidence_score (0 to 100), and factors (array). "
        "If evidence is limited, state that in factors and use conservative confidence.", user_prompt,
    )
    try:
        result = _RiskOutput.model_validate(raw)
        if result.risk_level not in {"Low", "Medium", "High"}:
            raise ValueError("Invalid risk level")
    except (ValidationError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="The AI returned an invalid risk assessment. Please try again.") from exc
    return repository.create_risk_prediction(db, AIRiskPredictionCreate(
        project_id=payload.project_id, task_id=payload.task_id, risk_type=result.risk_type,
        risk_level=result.risk_level, probability=result.probability, impact=result.impact,
        recommendation=result.recommendation, ai_model=GROQ_MODEL, prompt=user_prompt,
        prediction_result=raw, confidence_score=result.confidence_score,
    ))


def update_risk_prediction(db: Session, prediction_id: UUID, payload: AIRiskPredictionUpdate) -> AIRiskPrediction:
    prediction = repository.update_risk_prediction(db, prediction_id, payload)
    if prediction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Risk prediction not found")
    return prediction


def delete_risk_prediction(db: Session, prediction_id: UUID) -> None:
    deleted = repository.delete_risk_prediction(db, prediction_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Risk prediction not found")
