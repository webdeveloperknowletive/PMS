"""Create and seed the small notification settings table."""

from sqlalchemy.orm import Session

from app.core.database import engine
from app.modules.notifications.model import NotificationSetting, NotificationUserSetting


def ensure_notification_settings() -> None:
    NotificationSetting.__table__.create(bind=engine, checkfirst=True)
    NotificationUserSetting.__table__.create(bind=engine, checkfirst=True)
    with Session(bind=engine) as db:
        changed = False
        setting = db.get(NotificationSetting, "meeting_reminder_lead_minutes")
        if setting is None:
            db.add(NotificationSetting(setting_key="meeting_reminder_lead_minutes", setting_value="60"))
            changed = True
        toast_setting = db.get(NotificationSetting, "toast_duration_seconds")
        if toast_setting is None:
            db.add(NotificationSetting(setting_key="toast_duration_seconds", setting_value="8"))
            changed = True
        sound_setting = db.get(NotificationSetting, "notification_sound_key")
        if sound_setting is None:
            db.add(NotificationSetting(setting_key="notification_sound_key", setting_value="gentle_chime"))
            changed = True
        if changed:
            db.commit()
