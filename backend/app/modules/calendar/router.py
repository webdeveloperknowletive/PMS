from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.modules.calendar.model import CalendarEvent
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
    return db.query(CalendarEvent).offset(skip).limit(limit).all()


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
    event = db.get(CalendarEvent, event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calendar event not found")
    return event


@router.post(
    "/",
    response_model=CalendarEventRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(can_create_event)],
)
async def create_calendar_event(
    payload: CalendarEventCreate,
    db: Session = Depends(get_db),
):
    event = CalendarEvent(**payload.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.put("/{event_id}", response_model=CalendarEventRead, status_code=status.HTTP_200_OK)
async def update_calendar_event(
    event_id: UUID,
    payload: CalendarEventUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = db.get(CalendarEvent, event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calendar event not found")

    can_modify_event(organizer_id=event.organizer, current_user=current_user, db=db)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(event, field, value)

    db.commit()
    db.refresh(event)
    return event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_calendar_event(
    event_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = db.get(CalendarEvent, event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calendar event not found")

    can_modify_event(organizer_id=event.organizer, current_user=current_user, db=db)

    db.delete(event)
    db.commit()