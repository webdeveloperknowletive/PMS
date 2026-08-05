from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.calendar.model import CalendarEvent
from app.modules.calendar.schema import (
    CalendarEventCreate,
    CalendarEventUpdate,
)


def get_calendar_events(
    db: Session,
    skip: int = 0,
    limit: int = 100,
):
    """
    Get all calendar events.
    """
    return (
        db.query(CalendarEvent)
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_calendar_event(
    db: Session,
    event_id: UUID,
):
    """
    Get a calendar event by ID.
    """
    event = db.get(
        CalendarEvent,
        event_id,
    )

    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Calendar event not found",
        )

    return event


def create_calendar_event(
    db: Session,
    payload: CalendarEventCreate,
):
    """
    Create a new calendar event.
    """
    event = CalendarEvent(
        **payload.model_dump()
    )

    db.add(event)
    db.commit()
    db.refresh(event)

    return event


def update_calendar_event(
    db: Session,
    event_id: UUID,
    payload: CalendarEventUpdate,
):
    """
    Update an existing calendar event.
    """
    event = db.get(
        CalendarEvent,
        event_id,
    )

    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Calendar event not found",
        )

    for field, value in payload.model_dump(
        exclude_unset=True
    ).items():
        setattr(event, field, value)

    db.commit()
    db.refresh(event)

    return event


def delete_calendar_event(
    db: Session,
    event_id: UUID,
):
    """
    Delete a calendar event.
    """
    event = db.get(
        CalendarEvent,
        event_id,
    )

    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Calendar event not found",
        )

    db.delete(event)
    db.commit()

    return None