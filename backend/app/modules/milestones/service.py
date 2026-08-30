"""
==========================================================
                MILESTONES SERVICE
==========================================================

Business logic layer for Milestones. Orchestrates calls to
repository.py and translates "not found" into HTTP errors.
Routers should only ever call this layer, never the model
or repository directly.
"""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.milestones import repository
from app.modules.milestones.model import Milestone
from app.modules.milestones.schema import MilestoneCreate, MilestoneUpdate


def get_milestones(db: Session, skip: int = 0, limit: int = 100) -> list[Milestone]:
    """Get all milestones (paginated)."""
    return repository.get_milestones(db, skip=skip, limit=limit)


def get_milestone(db: Session, milestone_id: UUID) -> Milestone:
    """Get a single milestone by ID, or raise 404."""
    milestone = repository.get_milestone(db, milestone_id)
    if milestone is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found")
    return milestone


def create_milestone(db: Session, payload: MilestoneCreate) -> Milestone:
    """Create a new milestone."""
    return repository.create_milestone(db, payload)


def update_milestone(db: Session, milestone_id: UUID, payload: MilestoneUpdate) -> Milestone:
    """Update an existing milestone, or raise 404."""
    milestone = repository.update_milestone(db, milestone_id, payload)
    if milestone is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found")
    return milestone


def delete_milestone(db: Session, milestone_id: UUID) -> None:
    """Delete a milestone, or raise 404."""
    deleted = repository.delete_milestone(db, milestone_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found")
