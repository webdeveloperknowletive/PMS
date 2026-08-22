from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.modules.notifications.model import Notification
from app.modules.notifications.schema import NotificationCreate, NotificationRead, NotificationUpdate
from app.modules.notifications.permissions import can_access_notification, can_create_notification
from app.modules.users.model import User

router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"]
)


@router.get("/", response_model=list[NotificationRead], status_code=status.HTTP_200_OK)
async def get_notifications(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # NOTE: still returns every user's notifications, not just yours — this
    # endpoint has no server-side user filter (a known gap from earlier in
    # the project). This only guarantees you're logged in; the frontend is
    # still responsible for filtering to `user_id == current user` itself.
    return db.query(Notification).offset(skip).limit(limit).all()


@router.get("/{notification_id}", response_model=NotificationRead, status_code=status.HTTP_200_OK)
async def get_notification(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notification = db.get(Notification, notification_id)
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    can_access_notification(notification_owner_id=notification.user_id, current_user=current_user, db=db)
    return notification


@router.post("/", response_model=NotificationRead, status_code=status.HTTP_201_CREATED)
async def create_notification(
    payload: NotificationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Self-notifications (e.g. the event-reminder feature) are always
    # allowed. Creating one on behalf of someone else requires Admin.
    if payload.user_id != current_user.user_id:
        can_create_notification(current_user=current_user, db=db)

    notification = Notification(**payload.model_dump())
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


@router.put("/{notification_id}", response_model=NotificationRead, status_code=status.HTTP_200_OK)
async def update_notification(
    notification_id: UUID,
    payload: NotificationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notification = db.get(Notification, notification_id)
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    can_access_notification(notification_owner_id=notification.user_id, current_user=current_user, db=db)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(notification, field, value)

    db.commit()
    db.refresh(notification)
    return notification


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notification = db.get(Notification, notification_id)
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    can_access_notification(notification_owner_id=notification.user_id, current_user=current_user, db=db)

    db.delete(notification)
    db.commit()