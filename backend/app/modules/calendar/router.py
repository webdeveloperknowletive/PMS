from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.modules.calendar.model import CalendarEvent
from app.modules.calendar.schema import CalendarEventCreate, CalendarEventRead, CalendarEventUpdate

router = APIRouter(
    prefix="/calendar/events",
    tags=["Calendar"]
)


@router.get("/", response_model=list[CalendarEventRead], status_code=status.HTTP_200_OK)
async def get_calendar_events(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return db.query(CalendarEvent).offset(skip).limit(limit).all()


@router.get("/{event_id}", response_model=CalendarEventRead, status_code=status.HTTP_200_OK)
async def get_calendar_event(
    event_id: UUID,
    db: Session = Depends(get_db),
):
    event = db.get(CalendarEvent, event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calendar event not found")
    return event


@router.post("/", response_model=CalendarEventRead, status_code=status.HTTP_201_CREATED)
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
    db: Session = Depends(get_db),
):
    event = db.get(CalendarEvent, event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calendar event not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(event, field, value)

    db.commit()
    db.refresh(event)
    return event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_calendar_event(
    event_id: UUID,
    db: Session = Depends(get_db),
):
    event = db.get(CalendarEvent, event_id)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calendar event not found")

    db.delete(event)
    db.commit()
