"""
==========================================================
                AI TASK ESTIMATION SERVICE
==========================================================

Business logic layer for AI task estimations. See the note
in ai/doc_generator/service.py — this module stores results,
it does not call an LLM itself.
"""

from uuid import UUID
from decimal import Decimal

from fastapi import HTTPException, status
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.orm import Session

from app.core.config import GROQ_MODEL
from app.modules.ai.generation import generate_structured
from app.modules.ai.task_estimation import repository
from app.modules.ai.task_estimation.model import AITaskEstimation
from app.modules.ai.task_estimation.schema import AITaskEstimationCreate, AITaskEstimationGenerationRequest, AITaskEstimationUpdate
from app.modules.tasks.model import Task


class _EstimationOutput(BaseModel):
    estimated_hours: float = Field(..., ge=0)
    estimated_cost: float | None = Field(None, ge=0)
    complexity: str
    story_points: int | None = Field(None, ge=0)
    ai_reasoning: str
    confidence_score: float | None = Field(None, ge=0, le=100)


def get_task_estimations(db: Session, skip: int = 0, limit: int = 100) -> list[AITaskEstimation]:
    return repository.get_task_estimations(db, skip=skip, limit=limit)


def get_task_estimation(db: Session, estimation_id: UUID) -> AITaskEstimation:
    estimation = repository.get_task_estimation(db, estimation_id)
    if estimation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task estimation not found")
    return estimation


def generate_task_estimation(db: Session, payload: AITaskEstimationCreate) -> AITaskEstimation:
    return repository.create_task_estimation(db, payload)


def generate_task_estimation_with_ai(db: Session, payload: AITaskEstimationGenerationRequest) -> AITaskEstimation:
    task = db.get(Task, payload.task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    user_prompt = (
        f"Task: {task.task_name}\nDescription: {task.description or 'Not provided'}\n"
        f"Priority: {task.priority}\nStatus: {task.status}\n"
        f"Hourly rate for optional cost estimate: {payload.hourly_rate if payload.hourly_rate is not None else 'not supplied'}\n"
        f"Additional direction: {payload.prompt or 'Estimate a realistic range for a professional delivery team.'}"
    )
    raw = generate_structured(
        "Estimate the supplied project task. Return JSON with estimated_hours (number), estimated_cost (number or null), "
        "complexity (Low, Medium, or High), story_points (integer or null), ai_reasoning (short explanation), "
        "and confidence_score (0 to 100). Keep all estimates grounded in the task description.", user_prompt,
    )
    try:
        result = _EstimationOutput.model_validate(raw)
        if result.complexity not in {"Low", "Medium", "High"}:
            raise ValueError("Invalid complexity")
    except (ValidationError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="The AI returned an invalid estimate. Please try again.") from exc
    cost = result.estimated_cost
    if cost is None and payload.hourly_rate is not None:
        cost = float(Decimal(str(result.estimated_hours)) * payload.hourly_rate)
    return repository.create_task_estimation(db, AITaskEstimationCreate(
        task_id=task.task_id, project_id=task.project_id, estimated_hours=result.estimated_hours,
        estimated_cost=cost, complexity=result.complexity, story_points=result.story_points,
        ai_reasoning=result.ai_reasoning, prompt=user_prompt, ai_model=GROQ_MODEL,
        confidence_score=result.confidence_score,
    ))


def update_task_estimation(db: Session, estimation_id: UUID, payload: AITaskEstimationUpdate) -> AITaskEstimation:
    estimation = repository.update_task_estimation(db, estimation_id, payload)
    if estimation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task estimation not found")
    return estimation


def delete_task_estimation(db: Session, estimation_id: UUID) -> None:
    deleted = repository.delete_task_estimation(db, estimation_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task estimation not found")
