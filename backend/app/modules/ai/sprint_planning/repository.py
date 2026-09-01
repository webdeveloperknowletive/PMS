"""
==========================================================
                AI SPRINT PLANNING REPOSITORY
==========================================================

Data-access layer for the AISprintPlan model.
"""

# ==========================================================
# Import Required Modules
# ==========================================================

from uuid import UUID

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
) -> list[AISprintPlan]:

    return (
        db.query(AISprintPlan)
        .order_by(AISprintPlan.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )



# ==========================================================
# Create
# ==========================================================

def create_sprint_plan(
    db: Session,
    payload: AISprintPlanCreate,
) -> AISprintPlan:

    sprint_plan = AISprintPlan(**payload.model_dump())

    db.add(sprint_plan)
    db.commit()
    db.refresh(sprint_plan)

    return sprint_plan


# ==========================================================
# Read
# ==========================================================

def get_sprint_plan(
    db: Session,
    sprint_plan_id: UUID,
) -> AISprintPlan | None:

    return db.get(AISprintPlan, sprint_plan_id)


def get_sprint_plans_by_project(
    db: Session,
    project_id: UUID,
    skip: int = 0,
    limit: int = 100,
) -> list[AISprintPlan]:

    return (
        db.query(AISprintPlan)
        .filter(AISprintPlan.project_id == project_id)
        .order_by(AISprintPlan.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_sprint_plans_by_user(
    db: Session,
    generated_by: UUID,
) -> list[AISprintPlan]:

    return (
        db.query(AISprintPlan)
        .filter(AISprintPlan.generated_by == generated_by)
        .all()
    )


def get_sprint_plans_by_status(
    db: Session,
    project_id: UUID,
    status: str,
) -> list[AISprintPlan]:

    return (
        db.query(AISprintPlan)
        .filter(
            AISprintPlan.project_id == project_id,
            AISprintPlan.status == status,
        )
        .all()
    )


# ==========================================================
# Update
# ==========================================================

def update_sprint_plan(
    db: Session,
    sprint_plan_id: UUID,
    payload: AISprintPlanUpdate,
) -> AISprintPlan | None:

    sprint_plan = db.get(AISprintPlan, sprint_plan_id)

    if sprint_plan is None:
        return None

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(sprint_plan, field, value)

    db.commit()
    db.refresh(sprint_plan)

    return sprint_plan


def update_sprint_plan_status(
    db: Session,
    sprint_plan_id: UUID,
    status: str,
) -> AISprintPlan | None:

    sprint_plan = db.get(AISprintPlan, sprint_plan_id)

    if sprint_plan is None:
        return None

    sprint_plan.status = status

    db.commit()
    db.refresh(sprint_plan)

    return sprint_plan


# ==========================================================
# Delete
# ==========================================================

def delete_sprint_plan(
    db: Session,
    sprint_plan_id: UUID,
) -> bool:

    sprint_plan = db.get(AISprintPlan, sprint_plan_id)

    if sprint_plan is None:
        return False

    db.delete(sprint_plan)
    db.commit()

    return True
