from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.modules.notifications.model import Notification
from app.modules.notifications.schema import NotificationCreate, NotificationRead, NotificationUpdate

router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"]
)


@router.get("/", response_model=list[NotificationRead], status_code=status.HTTP_200_OK)
async def get_notifications(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return db.query(Notification).offset(skip).limit(limit).all()


@router.get("/{notification_id}", response_model=NotificationRead, status_code=status.HTTP_200_OK)
async def get_notification(
    notification_id: UUID,
    db: Session = Depends(get_db),
):
    notification = db.get(Notification, notification_id)
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return notification


@router.post("/", response_model=NotificationRead, status_code=status.HTTP_201_CREATED)
async def create_notification(
    payload: NotificationCreate,
    db: Session = Depends(get_db),
):
    notification = Notification(**payload.model_dump())
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


@router.put("/{notification_id}", response_model=NotificationRead, status_code=status.HTTP_200_OK)
async def update_notification(
    notification_id: UUID,
    payload: NotificationUpdate,
    db: Session = Depends(get_db),
):
    notification = db.get(Notification, notification_id)
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(notification, field, value)

    db.commit()
    db.refresh(notification)
    return notification


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: UUID,
    db: Session = Depends(get_db),
):
    notification = db.get(Notification, notification_id)
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    db.delete(notification)
    db.commit()
