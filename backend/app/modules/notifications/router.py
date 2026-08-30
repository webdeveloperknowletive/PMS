from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.modules.notifications import service
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
    return service.get_notifications(db, skip=skip, limit=limit)


@router.get("/{notification_id}", response_model=NotificationRead, status_code=status.HTTP_200_OK)
async def get_notification(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notification = service.get_notification(db, notification_id)
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

    return service.create_notification(db, payload)


@router.put("/{notification_id}", response_model=NotificationRead, status_code=status.HTTP_200_OK)
async def update_notification(
    notification_id: UUID,
    payload: NotificationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notification = service.get_notification(db, notification_id)
    can_access_notification(notification_owner_id=notification.user_id, current_user=current_user, db=db)
    return service.update_notification(db, notification_id, payload)


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notification = service.get_notification(db, notification_id)
    can_access_notification(notification_owner_id=notification.user_id, current_user=current_user, db=db)
    service.delete_notification(db, notification_id)
