from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.ai.sprint_planning.model import AISprintPlan
from app.modules.ai.sprint_planning.schema import (
    AISprintPlanCreate,
    AISprintPlanUpdate,
)


def get_sprint_plans(
    db: Session,
    skip: int = 0,
    limit: int = 100,
):
    """
    Get all AI sprint plans.
    """
    return (
        db.query(AISprintPlan)
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_sprint_plan(
    db: Session,
    sprint_plan_id: UUID,
):
    """
    Get AI sprint plan by ID.
    """
    sprint_plan = db.get(
        AISprintPlan,
        sprint_plan_id,
    )

    if sprint_plan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sprint plan not found",
        )

    return sprint_plan


def generate_sprint_plan(
    db: Session,
    payload: AISprintPlanCreate,
):
    """
    Generate a new AI sprint plan.
    """
    sprint_plan = AISprintPlan(
        **payload.model_dump()
    )

    db.add(sprint_plan)
    db.commit()
    db.refresh(sprint_plan)

    return sprint_plan


def update_sprint_plan(
    db: Session,
    sprint_plan_id: UUID,
    payload: AISprintPlanUpdate,
):
    """
    Update an existing AI sprint plan.
    """
    sprint_plan = db.get(
        AISprintPlan,
        sprint_plan_id,
    )

    if sprint_plan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sprint plan not found",
        )

    for field, value in payload.model_dump(
        exclude_unset=True
    ).items():
        setattr(sprint_plan, field, value)

    db.commit()
    db.refresh(sprint_plan)

    return sprint_plan


def delete_sprint_plan(
    db: Session,
    sprint_plan_id: UUID,
):
    """
    Delete an AI sprint plan.
    """
    sprint_plan = db.get(
        AISprintPlan,
        sprint_plan_id,
    )

    if sprint_plan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sprint plan not found",
        )

    db.delete(sprint_plan)
    db.commit()

    return None