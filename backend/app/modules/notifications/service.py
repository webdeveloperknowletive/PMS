"""
==========================================================
                NOTIFICATIONS SERVICE
==========================================================

Business logic layer for Notifications. Orchestrates
calls to repository.py and translates "not found" into
HTTP errors. Routers should only ever call this layer,
never the model or repository directly.
"""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.notifications import repository
from app.modules.notifications.model import Notification
from app.modules.notifications.schema import NotificationCreate, NotificationUpdate


def get_notifications(db: Session, user_id: UUID, skip: int = 0, limit: int = 100) -> list[Notification]:
    """Return notifications owned by the signed-in user."""
    return repository.get_notifications_by_user(db, user_id=user_id, skip=skip, limit=limit)


def get_notification(db: Session, notification_id: UUID) -> Notification:
    """Get a single notification by ID, or raise 404."""
    notification = repository.get_notification(db, notification_id)
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return notification


def create_notification(db: Session, payload: NotificationCreate, *, commit: bool = True) -> Notification:
    """Create a new notification."""
    return repository.create_notification(db, payload, commit=commit)


def update_notification(db: Session, notification_id: UUID, payload: NotificationUpdate) -> Notification:
    """Update an existing notification, or raise 404."""
    notification = repository.update_notification(db, notification_id, payload)
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return notification


def delete_notification(db: Session, notification_id: UUID) -> None:
    """Delete a notification, or raise 404."""
    deleted = repository.delete_notification(db, notification_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
