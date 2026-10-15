"""
==========================================================
                CALENDAR SERVICE
==========================================================

Business logic layer for Calendar Events. Orchestrates
calls to repository.py and translates "not found" into
HTTP errors. Routers should only ever call this layer,
never the model or repository directly.
"""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.calendar import repository
from app.modules.calendar.model import CalendarEvent
from app.modules.calendar.schema import CalendarEventCreate, CalendarEventUpdate
from app.modules.notifications.events import notify_project_users
from app.modules.users.model import User


def get_calendar_events(db: Session, current_user: User, skip: int = 0, limit: int = 100) -> list[CalendarEvent]:
    """Show shared organization events and only this user's personal events."""
    return repository.get_calendar_events(db, user_id=current_user.user_id, skip=skip, limit=limit)


def get_calendar_event(db: Session, event_id: UUID, current_user: User) -> CalendarEvent:
    """Get a single calendar event by ID, or raise 404."""
    event = repository.get_calendar_event(db, event_id, current_user.user_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calendar event not found")
    return event


def create_calendar_event(db: Session, payload: CalendarEventCreate, actor: User) -> CalendarEvent:
    """Create a new calendar event."""
    values = payload.model_dump()
    if payload.calendar_scope == "PERSONAL":
        if payload.calendar_owner_id not in (None, actor.user_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only create entries in your own personal calendar")
        values["calendar_owner_id"] = actor.user_id
    else:
        values["calendar_owner_id"] = None
    values["organizer"] = actor.user_id
    values["related_task_id"] = None
    event = CalendarEvent(**values)
    db.add(event)
    db.commit()
    db.refresh(event)
    notify_project_users(
        db, event.project_id, actor_id=actor.user_id,
        additional_user_ids={event.organizer} if event.organizer else set(),
        title=f"Meeting scheduled: {event.title}",
        message=f"{actor.name} scheduled a {event.event_type.lower()} for {event.start_datetime:%b %d, %Y at %I:%M %p}.",
        notification_type="Meeting Scheduled",
    )
    return event


def update_calendar_event(db: Session, event_id: UUID, payload: CalendarEventUpdate, actor: User) -> CalendarEvent:
    """Update an existing calendar event, or raise 404."""
    event = repository.update_calendar_event(db, event_id, payload)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calendar event not found")
    notify_project_users(
        db, event.project_id, actor_id=actor.user_id,
        additional_user_ids={event.organizer} if event.organizer else set(),
        title=f"Meeting updated: {event.title}",
        message=f"{actor.name} changed the meeting details or time.",
        notification_type="Meeting Updated",
    )
    return event


def delete_calendar_event(db: Session, event_id: UUID, actor: User) -> None:
    """Delete a calendar event, or raise 404."""
    event = get_calendar_event(db, event_id, current_user=actor)
    project_id, event_title, organizer_id = event.project_id, event.title, event.organizer
    deleted = repository.delete_calendar_event(db, event_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calendar event not found")
    notify_project_users(
        db, project_id, actor_id=actor.user_id,
        additional_user_ids={organizer_id} if organizer_id else set(),
        title=f"Meeting cancelled: {event_title}",
        message=f"{actor.name} cancelled this calendar event.",
        notification_type="Meeting Cancelled",
    )
