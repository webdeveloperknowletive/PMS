"""
==========================================================
                NOTIFICATIONS REPOSITORY
==========================================================

Data-access layer for the Notification model.
"""

# ==========================================================
# Import Required Modules
# ==========================================================

from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.notifications.model import Notification
from app.modules.notifications.schema import NotificationCreate, NotificationUpdate


# ==========================================================
# Create
# ==========================================================

def create_notification(
    db: Session,
    payload: NotificationCreate,
) -> Notification:

    notification = Notification(**payload.model_dump())

    db.add(notification)
    db.commit()
    db.refresh(notification)

    return notification


# ==========================================================
# Read
# ==========================================================

def get_notifications(
    db: Session,
    skip: int = 0,
    limit: int = 100,
) -> list[Notification]:

    return (
        db.query(Notification)
        .order_by(Notification.sent_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_notification(
    db: Session,
    notification_id: UUID,
) -> Notification | None:

    return db.get(Notification, notification_id)


def get_notifications_by_user(
    db: Session,
    user_id: UUID,
    skip: int = 0,
    limit: int = 100,
) -> list[Notification]:

    return (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(Notification.sent_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_unread_notifications(
    db: Session,
    user_id: UUID,
) -> list[Notification]:

    return (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.is_read.is_(False),
        )
        .order_by(Notification.sent_at.desc())
        .all()
    )


def count_unread_notifications(
    db: Session,
    user_id: UUID,
) -> int:

    return (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.is_read.is_(False),
        )
        .count()
    )


def get_notifications_by_project(
    db: Session,
    project_id: UUID,
) -> list[Notification]:

    return (
        db.query(Notification)
        .filter(Notification.project_id == project_id)
        .all()
    )


# ==========================================================
# Update
# ==========================================================

def update_notification(
    db: Session,
    notification_id: UUID,
    payload: NotificationUpdate,
) -> Notification | None:

    notification = db.get(Notification, notification_id)

    if notification is None:
        return None

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(notification, field, value)

    db.commit()
    db.refresh(notification)

    return notification


def mark_notification_read(
    db: Session,
    notification_id: UUID,
) -> Notification | None:

    notification = db.get(Notification, notification_id)

    if notification is None:
        return None

    notification.is_read = True

    db.commit()
    db.refresh(notification)

    return notification


def mark_all_notifications_read(
    db: Session,
    user_id: UUID,
) -> int:

    updated = (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.is_read.is_(False),
        )
        .update({"is_read": True})
    )

    db.commit()

    return updated


# ==========================================================
# Delete
# ==========================================================

def delete_notification(
    db: Session,
    notification_id: UUID,
) -> bool:

    notification = db.get(Notification, notification_id)

    if notification is None:
        return False

    db.delete(notification)
    db.commit()

    return True
