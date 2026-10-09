"""
==========================================================
                AI SPRINT PLANNING SERVICE
==========================================================

Business logic layer for AI sprint plans. See the note in
ai/doc_generator/service.py — this module stores results,
it does not call an LLM itself.
"""

from uuid import UUID
from typing import Any

from fastapi import HTTPException, status
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.orm import Session

from app.core.config import GROQ_MODEL
from app.modules.ai.generation import generate_structured
from app.modules.ai.sprint_planning import repository
from app.modules.ai.sprint_planning.model import AISprintPlan
from app.modules.ai.sprint_planning.schema import AISprintPlanCreate, AISprintPlanGenerationRequest, AISprintPlanUpdate
from app.modules.projects.model import Project
from app.modules.tasks.model import Task


class _SprintOutput(BaseModel):
    suggested_tasks: list[Any] = Field(default_factory=list)
    estimated_story_points: int | None = None
    confidence_score: float | None = Field(None, ge=0, le=100)


def get_sprint_plans(db: Session, skip: int = 0, limit: int = 100) -> list[AISprintPlan]:
    return repository.get_sprint_plans(db, skip=skip, limit=limit)


def get_sprint_plan(db: Session, sprint_plan_id: UUID) -> AISprintPlan:
    sprint_plan = repository.get_sprint_plan(db, sprint_plan_id)
    if sprint_plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint plan not found")
    return sprint_plan


def generate_sprint_plan(db: Session, payload: AISprintPlanCreate) -> AISprintPlan:
    return repository.create_sprint_plan(db, payload)


def generate_sprint_plan_with_ai(db: Session, payload: AISprintPlanGenerationRequest, generated_by: UUID) -> AISprintPlan:
    project = db.get(Project, payload.project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    tasks = (db.query(Task).filter(Task.project_id == payload.project_id, Task.status.notin_(["DONE", "CANCELLED"]))
             .order_by(Task.priority.desc(), Task.due_date.asc().nullslast()).limit(40).all())
    task_context = [{"task_id": str(task.task_id), "name": task.task_name, "description": task.description,
                     "status": task.status, "priority": task.priority, "due_date": str(task.due_date) if task.due_date else None}
                    for task in tasks]
    user_prompt = (
        f"Project: {project.project_name}\nProject description: {project.description or 'Not provided'}\n"
        f"Sprint name: {payload.sprint_name}\nSprint goal: {payload.sprint_goal}\n"
        f"Duration: {payload.sprint_duration_days} days\nOpen tasks: {task_context}\n"
        f"Additional direction: {payload.prompt or 'Balance scope with the sprint goal.'}"
    )
    raw = generate_structured(
        "You are a pragmatic agile delivery planner. Use only the supplied tasks; never invent task IDs. "
        "Return JSON with suggested_tasks (array of objects containing task_id, task_name, story_points, reason), "
        "estimated_story_points (integer), and confidence_score (0 to 100).",
        user_prompt,
    )
    try:
        result = _SprintOutput.model_validate(raw)
    except ValidationError as exc:
        raise HTTPException(status_code=502, detail="The AI returned an invalid sprint plan. Please try again.") from exc
    return repository.create_sprint_plan(db, AISprintPlanCreate(
        project_id=payload.project_id, generated_by=generated_by, sprint_name=payload.sprint_name,
        sprint_goal=payload.sprint_goal, sprint_duration_days=payload.sprint_duration_days,
        suggested_tasks=result.suggested_tasks, estimated_story_points=result.estimated_story_points,
        ai_model=GROQ_MODEL, prompt=user_prompt, ai_response=raw, confidence_score=result.confidence_score,
        status="Generated",
    ))


def update_sprint_plan(db: Session, sprint_plan_id: UUID, payload: AISprintPlanUpdate) -> AISprintPlan:
    sprint_plan = repository.update_sprint_plan(db, sprint_plan_id, payload)
    if sprint_plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint plan not found")
    return sprint_plan


def delete_sprint_plan(db: Session, sprint_plan_id: UUID) -> None:
    deleted = repository.delete_sprint_plan(db, sprint_plan_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint plan not found")
