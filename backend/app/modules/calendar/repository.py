"""
==========================================================
                CALENDAR REPOSITORY
==========================================================

Data-access layer for the CalendarEvent model.
"""

# ==========================================================
# Import Required Modules
# ==========================================================

from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.calendar.model import CalendarEvent
from app.modules.calendar.schema import CalendarEventCreate, CalendarEventUpdate


# ==========================================================
# Create
# ==========================================================

def create_calendar_event(
    db: Session,
    payload: CalendarEventCreate,
) -> CalendarEvent:

    event = CalendarEvent(**payload.model_dump())

    db.add(event)
    db.commit()
    db.refresh(event)

    return event


# ==========================================================
# Read
# ==========================================================

def get_calendar_event(
    db: Session,
    event_id: UUID,
    user_id: UUID,
) -> CalendarEvent | None:
    return (
        db.query(CalendarEvent)
        .filter(
            CalendarEvent.event_id == event_id,
            (CalendarEvent.calendar_scope == "ORGANIZATION")
            | ((CalendarEvent.calendar_scope == "PERSONAL") & (CalendarEvent.calendar_owner_id == user_id)),
        )
        .one_or_none()
    )


def get_calendar_events(
    db: Session,
    user_id: UUID,
    skip: int = 0,
    limit: int = 100,
) -> list[CalendarEvent]:

    return (
        db.query(CalendarEvent)
        .filter(
            (CalendarEvent.calendar_scope == "ORGANIZATION")
            | ((CalendarEvent.calendar_scope == "PERSONAL") & (CalendarEvent.calendar_owner_id == user_id))
        )
        .order_by(CalendarEvent.start_datetime.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_calendar_events_by_project(
    db: Session,
    project_id: UUID,
    skip: int = 0,
    limit: int = 100,
) -> list[CalendarEvent]:

    return (
        db.query(CalendarEvent)
        .filter(CalendarEvent.project_id == project_id)
        .order_by(CalendarEvent.start_datetime.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_calendar_events_by_organizer(
    db: Session,
    organizer: UUID,
) -> list[CalendarEvent]:

    return (
        db.query(CalendarEvent)
        .filter(CalendarEvent.organizer == organizer)
        .all()
    )


def get_calendar_events_in_range(
    db: Session,
    project_id: UUID,
    start: datetime,
    end: datetime,
) -> list[CalendarEvent]:

    return (
        db.query(CalendarEvent)
        .filter(
            CalendarEvent.project_id == project_id,
            CalendarEvent.start_datetime <= end,
            CalendarEvent.end_datetime >= start,
        )
        .order_by(CalendarEvent.start_datetime.asc())
        .all()
    )


# ==========================================================
# Update
# ==========================================================

def update_calendar_event(
    db: Session,
    event_id: UUID,
    payload: CalendarEventUpdate,
) -> CalendarEvent | None:

    event = db.get(CalendarEvent, event_id)

    if event is None:
        return None

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(event, field, value)

    db.commit()
    db.refresh(event)

    return event


# ==========================================================
# Delete
# ==========================================================

def delete_calendar_event(
    db: Session,
    event_id: UUID,
) -> bool:

    event = db.get(CalendarEvent, event_id)

    if event is None:
        return False

    db.delete(event)
    db.commit()

    return True
