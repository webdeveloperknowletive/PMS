"""
==========================================================
                AI SPRINT PLANNING SERVICE
==========================================================

Business logic layer for AI sprint plans. See the note in
ai/doc_generator/service.py — this module stores results,
it does not call an LLM itself.
"""

from datetime import date, timedelta
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
from app.modules.tasks.model import TaskSprint
from app.modules.calendar.automatic import add_automatic_calendar_entries
from app.modules.notifications.events import notify_project_users, project_recipient_ids
from app.modules.users.model import User
from app.modules.ai.sprint_planning.schema import AISprintPlanApplyRequest


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


def apply_sprint_plan(db: Session, sprint_plan_id: UUID, payload: AISprintPlanApplyRequest, actor: User) -> AISprintPlan:
    plan = db.query(AISprintPlan).filter(
        AISprintPlan.sprint_plan_id == sprint_plan_id,
        AISprintPlan.organization_id == actor.organization_id,
    ).with_for_update().one_or_none()
    if plan is None:
        raise HTTPException(status_code=404, detail="Sprint plan not found")
    if plan.applied_sprint_id is not None:
        raise HTTPException(status_code=409, detail="This AI plan has already been applied")
    project = db.query(Project).filter(
        Project.project_id == plan.project_id,
        Project.organization_id == actor.organization_id,
    ).one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    suggestions = {
        str(item.get("task_id")): item
        for item in (plan.suggested_tasks or [])
        if isinstance(item, dict) and item.get("task_id")
    }
    selected = [str(task_id) for task_id in payload.selected_task_ids]
    if any(task_id not in suggestions for task_id in selected):
        raise HTTPException(status_code=400, detail="Select only tasks suggested by this AI plan")
    tasks = db.query(Task).filter(
        Task.task_id.in_(payload.selected_task_ids),
        Task.project_id == plan.project_id,
        Task.organization_id == actor.organization_id,
    ).all()
    if len(tasks) != len(selected):
        raise HTTPException(status_code=400, detail="One or more suggested tasks are no longer available")
    if any(task.sprint_id is not None for task in tasks):
        raise HTTPException(status_code=409, detail="Remove tasks already assigned to a sprint before applying this plan")
    if any(task.status in {"DONE", "CANCELLED"} or task.archived_at is not None for task in tasks):
        raise HTTPException(status_code=409, detail="Completed, cancelled, or archived tasks cannot be added to this sprint")

    def story_points_for(task_id: str) -> int:
        value = suggestions[task_id].get("story_points")
        return value if isinstance(value, int) and not isinstance(value, bool) and 0 <= value <= 100 else 0

    start_date = max(date.today(), project.start_date) if project.start_date else date.today()
    end_date = start_date + timedelta(days=plan.sprint_duration_days - 1)
    sprint = TaskSprint(
        organization_id=actor.organization_id,
        project_id=plan.project_id,
        sprint_name=plan.sprint_name,
        goal=plan.sprint_goal,
        start_date=start_date,
        end_date=end_date,
        capacity_points=sum(story_points_for(key) for key in selected),
        status="PLANNED",
        created_by=actor.user_id,
    )
    db.add(sprint)
    db.flush()
    for task in tasks:
        task.sprint_id = sprint.sprint_id
        suggested_points = suggestions[str(task.task_id)].get("story_points")
        if isinstance(suggested_points, int) and not isinstance(suggested_points, bool) and 0 <= suggested_points <= 100:
            task.story_points = suggested_points
    plan.applied_sprint_id = sprint.sprint_id
    plan.status = "Applied"
    add_automatic_calendar_entries(
        db, project_id=plan.project_id, actor_id=actor.user_id,
        title=f"Sprint planned: {sprint.sprint_name}", description=f"{actor.name} applied an AI sprint plan.",
        event_type="Planning", personal_user_ids=project_recipient_ids(db, plan.project_id) | {actor.user_id},
        event_date=start_date,
    )
    db.commit()
    db.refresh(plan)
    notify_project_users(db, plan.project_id, actor_id=actor.user_id,
        title=f"Sprint planned: {sprint.sprint_name}", message=f"{actor.name} applied an AI sprint plan.",
        notification_type="Sprint Created")
    return plan


def delete_sprint_plan(db: Session, sprint_plan_id: UUID) -> None:
    deleted = repository.delete_sprint_plan(db, sprint_plan_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint plan not found")
