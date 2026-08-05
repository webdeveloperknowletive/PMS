from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.milestones.model import Milestone
from app.modules.milestones.schema import (
    MilestoneCreate,
    MilestoneUpdate,
)


def get_milestones(
    db: Session,
    skip: int = 0,
    limit: int = 100,
):
    """
    Get all milestones.
    """
    return (
        db.query(Milestone)
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_milestone(
    db: Session,
    milestone_id: UUID,
):
    """
    Get a milestone by ID.
    """
    milestone = db.get(
        Milestone,
        milestone_id,
    )

    if milestone is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Milestone not found",
        )

    return milestone


def create_milestone(
    db: Session,
    payload: MilestoneCreate,
):
    """
    Create a new milestone.
    """
    milestone = Milestone(
        **payload.model_dump()
    )

    db.add(milestone)
    db.commit()
    db.refresh(milestone)

    return milestone


def update_milestone(
    db: Session,
    milestone_id: UUID,
    payload: MilestoneUpdate,
):
    """
    Update an existing milestone.
    """
    milestone = db.get(
        Milestone,
        milestone_id,
    )

    if milestone is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Milestone not found",
        )

    for field, value in payload.model_dump(
        exclude_unset=True
    ).items():
        setattr(
            milestone,
            field,
            value,
        )

    db.commit()
    db.refresh(milestone)

    return milestone


def delete_milestone(
    db: Session,
    milestone_id: UUID,
):
    """
    Delete a milestone.
    """
    milestone = db.get(
        Milestone,
        milestone_id,
    )

    if milestone is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Milestone not found",
        )

    db.delete(milestone)
    db.commit()

    return None