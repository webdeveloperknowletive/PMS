from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.modules.calendar import service
from app.modules.calendar.schema import CalendarEventCreate, CalendarEventRead, CalendarEventUpdate
from app.modules.calendar.permissions import can_create_event, can_modify_event, can_view_calendar
from app.modules.users.model import User

router = APIRouter(
    prefix="/calendar/events",
    tags=["Calendar"]
)


@router.get(
    "/",
    response_model=list[CalendarEventRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_calendar)],
)
async def get_calendar_events(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return service.get_calendar_events(db, skip=skip, limit=limit)


@router.get(
    "/{event_id}",
    response_model=CalendarEventRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_calendar)],
)
async def get_calendar_event(
    event_id: UUID,
    db: Session = Depends(get_db),
):
    return service.get_calendar_event(db, event_id)


@router.post(
    "/",
    response_model=CalendarEventRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(can_create_event)],
)
async def create_calendar_event(
    payload: CalendarEventCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.create_calendar_event(db, payload, actor=current_user)


@router.put("/{event_id}", response_model=CalendarEventRead, status_code=status.HTTP_200_OK)
async def update_calendar_event(
    event_id: UUID,
    payload: CalendarEventUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Fetched via the service layer (raises 404 if missing) so we know who
    # the organizer is — a static Depends() can't see that, so the
    # ownership check has to happen here, after the fetch.
    event = service.get_calendar_event(db, event_id)
    can_modify_event(organizer_id=event.organizer, current_user=current_user, db=db)

    return service.update_calendar_event(db, event_id, payload, actor=current_user)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_calendar_event(
    event_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = service.get_calendar_event(db, event_id)
    can_modify_event(organizer_id=event.organizer, current_user=current_user, db=db)

    service.delete_calendar_event(db, event_id, actor=current_user)
