"""
==========================================================
                AI TASK ESTIMATION SERVICE
==========================================================

Business logic layer for AI task estimations. See the note
in ai/doc_generator/service.py — this module stores results,
it does not call an LLM itself.
"""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.ai.task_estimation import repository
from app.modules.ai.task_estimation.model import AITaskEstimation
from app.modules.ai.task_estimation.schema import AITaskEstimationCreate, AITaskEstimationUpdate


def get_task_estimations(db: Session, skip: int = 0, limit: int = 100) -> list[AITaskEstimation]:
    return repository.get_task_estimations(db, skip=skip, limit=limit)


def get_task_estimation(db: Session, estimation_id: UUID) -> AITaskEstimation:
    estimation = repository.get_task_estimation(db, estimation_id)
    if estimation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task estimation not found")
    return estimation


def generate_task_estimation(db: Session, payload: AITaskEstimationCreate) -> AITaskEstimation:
    return repository.create_task_estimation(db, payload)


def update_task_estimation(db: Session, estimation_id: UUID, payload: AITaskEstimationUpdate) -> AITaskEstimation:
    estimation = repository.update_task_estimation(db, estimation_id, payload)
    if estimation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task estimation not found")
    return estimation


def delete_task_estimation(db: Session, estimation_id: UUID) -> None:
    deleted = repository.delete_task_estimation(db, estimation_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task estimation not found")
