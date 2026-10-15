"""Small helper for calendar entries created by project and task activity."""

from datetime import date, datetime, time, timedelta, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.calendar.model import CalendarEvent


def add_automatic_calendar_entries(
    db: Session,
    *,
    project_id: UUID,
    actor_id: UUID,
    title: str,
    description: str,
    event_type: str,
    personal_user_ids: set[UUID] | None = None,
    event_date: date | None = None,
    related_task_id: UUID | None = None,
) -> None:
    """Add one shared entry and private copies for the people involved.

    The caller controls the transaction, so this can be used atomically when
    creating a project or recording task activity.
    """
    start = (
        datetime.combine(event_date, time(hour=9), tzinfo=timezone.utc)
        if event_date
        else datetime.now(timezone.utc)
    )
    end = start + timedelta(minutes=30)
    common = {
        "project_id": project_id,
        "organizer": actor_id,
        "title": title[:255],
        "description": description,
        "event_type": event_type[:50],
        "start_datetime": start,
        "end_datetime": end,
        "is_automatic": True,
        "related_task_id": related_task_id,
    }
    db.add(CalendarEvent(**common, calendar_scope="ORGANIZATION", calendar_owner_id=None))
    for user_id in (personal_user_ids or {actor_id}):
        db.add(CalendarEvent(**common, calendar_scope="PERSONAL", calendar_owner_id=user_id))
