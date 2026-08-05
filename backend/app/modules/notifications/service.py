from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.notifications.model import Notification
from app.modules.notifications.schema import (
    NotificationCreate,
    NotificationUpdate,
)


def get_notifications(
    db: Session,
    skip: int = 0,
    limit: int = 100,
):
    """
    Get all notifications.
    """
    return (
        db.query(Notification)
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_notification(
    db: Session,
    notification_id: UUID,
):
    """
    Get a notification by ID.
    """
    notification = db.get(
        Notification,
        notification_id,
    )

    if notification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    return notification


def create_notification(
    db: Session,
    payload: NotificationCreate,
):
    """
    Create a new notification.
    """
    notification = Notification(
        **payload.model_dump()
    )

    db.add(notification)
    db.commit()
    db.refresh(notification)

    return notification


def update_notification(
    db: Session,
    notification_id: UUID,
    payload: NotificationUpdate,
):
    """
    Update an existing notification.
    """
    notification = db.get(
        Notification,
        notification_id,
    )

    if notification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    for field, value in payload.model_dump(
        exclude_unset=True
    ).items():
        setattr(
            notification,
            field,
            value,
        )

    db.commit()
    db.refresh(notification)

    return notification


def delete_notification(
    db: Session,
    notification_id: UUID,
):
    """
    Delete a notification.
    """
    notification = db.get(
        Notification,
        notification_id,
    )

    if notification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    db.delete(notification)
    db.commit()

    return None