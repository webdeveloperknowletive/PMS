from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.modules.notifications import service
from app.modules.notifications.schema import NotificationCreate, NotificationRead, NotificationUpdate
from app.modules.notifications.permissions import can_access_notification, can_create_notification
from app.modules.users.model import User
from app.modules.notifications.model import NotificationSetting, NotificationUserSetting
from app.modules.notifications.schema import (
    MeetingReminderSettingRead,
    MeetingReminderSettingUpdate,
    ToastDurationSettingRead,
    ToastDurationSettingUpdate,
    NotificationSoundSettingRead,
    NotificationSoundSettingUpdate,
    NotificationVolumeRead,
    NotificationVolumeUpdate,
)
from app.modules.roles.permissions import can_manage_roles

SOUND_KEYS = {"gentle_chime", "soft_bell", "double_ping", "clear_drop", "focus_ping", "bright_alert"}

router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"]
)


@router.get("/settings/meeting-reminder", response_model=MeetingReminderSettingRead)
async def get_meeting_reminder_setting(
    _current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    setting = db.get(NotificationSetting, "meeting_reminder_lead_minutes")
    return {"lead_minutes": int(setting.setting_value) if setting else 60}


@router.put("/settings/meeting-reminder", response_model=MeetingReminderSettingRead)
async def update_meeting_reminder_setting(
    payload: MeetingReminderSettingUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(can_manage_roles),
):
    setting = db.get(NotificationSetting, "meeting_reminder_lead_minutes")
    if setting is None:
        setting = NotificationSetting(setting_key="meeting_reminder_lead_minutes", setting_value=str(payload.lead_minutes))
        db.add(setting)
    else:
        setting.setting_value = str(payload.lead_minutes)
    db.commit()
    return {"lead_minutes": payload.lead_minutes}


@router.get("/settings/toast-duration", response_model=ToastDurationSettingRead)
async def get_toast_duration_setting(
    _current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    setting = db.get(NotificationSetting, "toast_duration_seconds")
    return {"duration_seconds": int(setting.setting_value) if setting else 8}


@router.put("/settings/toast-duration", response_model=ToastDurationSettingRead)
async def update_toast_duration_setting(
    payload: ToastDurationSettingUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(can_manage_roles),
):
    setting = db.get(NotificationSetting, "toast_duration_seconds")
    if setting is None:
        setting = NotificationSetting(setting_key="toast_duration_seconds", setting_value=str(payload.duration_seconds))
        db.add(setting)
    else:
        setting.setting_value = str(payload.duration_seconds)
    db.commit()
    return {"duration_seconds": payload.duration_seconds}


@router.get("/settings/sound", response_model=NotificationSoundSettingRead)
async def get_notification_sound_setting(
    _current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    setting = db.get(NotificationSetting, "notification_sound_key")
    sound_key = setting.setting_value if setting else "gentle_chime"
    return {"sound_key": sound_key if sound_key in SOUND_KEYS else "gentle_chime"}


@router.put("/settings/sound", response_model=NotificationSoundSettingRead)
async def update_notification_sound_setting(
    payload: NotificationSoundSettingUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(can_manage_roles),
):
    if payload.sound_key not in SOUND_KEYS:
        raise HTTPException(status_code=422, detail="Choose one of the available notification sounds.")
    setting = db.get(NotificationSetting, "notification_sound_key")
    if setting is None:
        setting = NotificationSetting(setting_key="notification_sound_key", setting_value=payload.sound_key)
        db.add(setting)
    else:
        setting.setting_value = payload.sound_key
    db.commit()
    return {"sound_key": payload.sound_key}


@router.get("/settings/volume", response_model=NotificationVolumeRead)
async def get_notification_volume_setting(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    setting = db.get(NotificationUserSetting, current_user.user_id)
    return {"volume_percent": setting.volume_percent if setting else 65}


@router.put("/settings/volume", response_model=NotificationVolumeRead)
async def update_notification_volume_setting(
    payload: NotificationVolumeUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    setting = db.get(NotificationUserSetting, current_user.user_id)
    if setting is None:
        setting = NotificationUserSetting(user_id=current_user.user_id, volume_percent=payload.volume_percent)
        db.add(setting)
    else:
        setting.volume_percent = payload.volume_percent
    db.commit()
    return {"volume_percent": payload.volume_percent}


@router.get("/", response_model=list[NotificationRead], status_code=status.HTTP_200_OK)
async def get_notifications(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_notifications(db, user_id=current_user.user_id, skip=skip, limit=limit)


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
