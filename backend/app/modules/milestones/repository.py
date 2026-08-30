"""
==========================================================
                MILESTONES REPOSITORY
==========================================================

Data-access layer for the Milestone model.
"""

# ==========================================================
# Import Required Modules
# ==========================================================

from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.milestones.model import Milestone
from app.modules.milestones.schema import MilestoneCreate, MilestoneUpdate

def get_milestones(
    db: Session,
    skip: int = 0,
    limit: int = 100,
) -> list[Milestone]:

    return (
        db.query(Milestone)
        .order_by(Milestone.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )



# ==========================================================
# Create
# ==========================================================

def create_milestone(
    db: Session,
    payload: MilestoneCreate,
) -> Milestone:

    milestone = Milestone(**payload.model_dump())

    db.add(milestone)
    db.commit()
    db.refresh(milestone)

    return milestone


# ==========================================================
# Read
# ==========================================================

def get_milestone(
    db: Session,
    milestone_id: UUID,
) -> Milestone | None:

    return db.get(Milestone, milestone_id)


def get_milestones_by_project(
    db: Session,
    project_id: UUID,
    skip: int = 0,
    limit: int = 100,
) -> list[Milestone]:

    return (
        db.query(Milestone)
        .filter(Milestone.project_id == project_id)
        .order_by(Milestone.due_date.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_pending_milestones(
    db: Session,
    project_id: UUID,
) -> list[Milestone]:

    return (
        db.query(Milestone)
        .filter(
            Milestone.project_id == project_id,
            Milestone.is_completed.is_(False),
        )
        .order_by(Milestone.due_date.asc())
        .all()
    )


# ==========================================================
# Update
# ==========================================================

def update_milestone(
    db: Session,
    milestone_id: UUID,
    payload: MilestoneUpdate,
) -> Milestone | None:

    milestone = db.get(Milestone, milestone_id)

    if milestone is None:
        return None

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(milestone, field, value)

    db.commit()
    db.refresh(milestone)

    return milestone


def mark_milestone_completed(
    db: Session,
    milestone_id: UUID,
) -> Milestone | None:

    milestone = db.get(Milestone, milestone_id)

    if milestone is None:
        return None

    milestone.is_completed = True

    db.commit()
    db.refresh(milestone)

    return milestone


# ==========================================================
# Delete
# ==========================================================

def delete_milestone(
    db: Session,
    milestone_id: UUID,
) -> bool:

    milestone = db.get(Milestone, milestone_id)

    if milestone is None:
        return False

    db.delete(milestone)
    db.commit()

    return True
