"""
==========================================================
                AI SPRINT PLANNING SERVICE
==========================================================

Business logic layer for AI sprint plans. See the note in
ai/doc_generator/service.py — this module stores results,
it does not call an LLM itself.
"""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.ai.sprint_planning import repository
from app.modules.ai.sprint_planning.model import AISprintPlan
from app.modules.ai.sprint_planning.schema import AISprintPlanCreate, AISprintPlanUpdate


def get_sprint_plans(db: Session, skip: int = 0, limit: int = 100) -> list[AISprintPlan]:
    return repository.get_sprint_plans(db, skip=skip, limit=limit)


def get_sprint_plan(db: Session, sprint_plan_id: UUID) -> AISprintPlan:
    sprint_plan = repository.get_sprint_plan(db, sprint_plan_id)
    if sprint_plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint plan not found")
    return sprint_plan


def generate_sprint_plan(db: Session, payload: AISprintPlanCreate) -> AISprintPlan:
    return repository.create_sprint_plan(db, payload)


def update_sprint_plan(db: Session, sprint_plan_id: UUID, payload: AISprintPlanUpdate) -> AISprintPlan:
    sprint_plan = repository.update_sprint_plan(db, sprint_plan_id, payload)
    if sprint_plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint plan not found")
    return sprint_plan


def delete_sprint_plan(db: Session, sprint_plan_id: UUID) -> None:
    deleted = repository.delete_sprint_plan(db, sprint_plan_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint plan not found")
