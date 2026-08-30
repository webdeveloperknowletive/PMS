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


def get_calendar_events(db: Session, skip: int = 0, limit: int = 100) -> list[CalendarEvent]:
    """Get all calendar events (paginated)."""
    return repository.get_calendar_events(db, skip=skip, limit=limit)


def get_calendar_event(db: Session, event_id: UUID) -> CalendarEvent:
    """Get a single calendar event by ID, or raise 404."""
    event = repository.get_calendar_event(db, event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calendar event not found")
    return event


def create_calendar_event(db: Session, payload: CalendarEventCreate) -> CalendarEvent:
    """Create a new calendar event."""
    return repository.create_calendar_event(db, payload)


def update_calendar_event(db: Session, event_id: UUID, payload: CalendarEventUpdate) -> CalendarEvent:
    """Update an existing calendar event, or raise 404."""
    event = repository.update_calendar_event(db, event_id, payload)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calendar event not found")
    return event


def delete_calendar_event(db: Session, event_id: UUID) -> None:
    """Delete a calendar event, or raise 404."""
    deleted = repository.delete_calendar_event(db, event_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calendar event not found")
