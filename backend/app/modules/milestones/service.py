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
from app.modules.notifications.events import notify_project_users
from app.modules.notifications.events import project_recipient_ids
from app.modules.users.model import User
from app.modules.calendar.automatic import add_automatic_calendar_entries


def get_milestones(db: Session, skip: int = 0, limit: int = 100) -> list[Milestone]:
    """Get all milestones (paginated)."""
    return repository.get_milestones(db, skip=skip, limit=limit)


def get_milestone(db: Session, milestone_id: UUID) -> Milestone:
    """Get a single milestone by ID, or raise 404."""
    milestone = repository.get_milestone(db, milestone_id)
    if milestone is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found")
    return milestone


def create_milestone(db: Session, payload: MilestoneCreate, actor: User) -> Milestone:
    """Create a new milestone."""
    milestone = repository.create_milestone(db, payload)
    add_automatic_calendar_entries(
        db,
        project_id=milestone.project_id,
        actor_id=actor.user_id,
        title=f"Milestone: {milestone.title}",
        description=f"Milestone due date: {milestone.title}.",
        event_type="Milestone",
        personal_user_ids=project_recipient_ids(db, milestone.project_id) | {actor.user_id},
        event_date=milestone.due_date,
    )
    db.commit()
    notify_project_users(db, milestone.project_id, actor_id=actor.user_id,
        title=f"Milestone created: {milestone.title}", message=f"{actor.name} created a project milestone.",
        notification_type="Milestone Created")
    return milestone


def update_milestone(db: Session, milestone_id: UUID, payload: MilestoneUpdate, actor: User) -> Milestone:
    """Update an existing milestone, or raise 404."""
    milestone = repository.update_milestone(db, milestone_id, payload)
    if milestone is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found")
    add_automatic_calendar_entries(
        db,
        project_id=milestone.project_id,
        actor_id=actor.user_id,
        title=f"Milestone updated: {milestone.title}",
        description=f"{actor.name} updated this milestone.",
        event_type="Work activity",
        personal_user_ids=project_recipient_ids(db, milestone.project_id) | {actor.user_id},
        event_date=milestone.due_date,
    )
    db.commit()
    notify_project_users(db, milestone.project_id, actor_id=actor.user_id,
        title=f"Milestone updated: {milestone.title}", message=f"{actor.name} updated the milestone.",
        notification_type="Milestone Updated")
    return milestone


def delete_milestone(db: Session, milestone_id: UUID, actor: User) -> None:
    """Delete a milestone, or raise 404."""
    milestone = get_milestone(db, milestone_id)
    project_id, title = milestone.project_id, milestone.title
    add_automatic_calendar_entries(
        db,
        project_id=project_id,
        actor_id=actor.user_id,
        title=f"Milestone deleted: {title}",
        description=f"{actor.name} deleted this milestone.",
        event_type="Work activity",
        personal_user_ids=project_recipient_ids(db, project_id) | {actor.user_id},
    )
    deleted = repository.delete_milestone(db, milestone_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found")
    notify_project_users(db, project_id, actor_id=actor.user_id,
        title=f"Milestone deleted: {title}", message=f"{actor.name} deleted the milestone.",
        notification_type="Milestone Deleted")
