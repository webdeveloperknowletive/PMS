import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class NotificationBase(BaseModel):
    user_id: uuid.UUID
    project_id: uuid.UUID | None = None
    title: str = Field(..., max_length=255)
    message: str
    notification_type: str = Field(..., max_length=50)
    is_read: bool = False


class NotificationCreate(NotificationBase):
    pass


class NotificationUpdate(BaseModel):
    is_read: bool | None = None


class NotificationRead(NotificationBase):
    model_config = ConfigDict(from_attributes=True)

    notification_id: uuid.UUID
    sent_at: datetime
    chat_conversation_id: uuid.UUID | None = None


class MeetingReminderSettingRead(BaseModel):
    lead_minutes: int = Field(..., ge=1, le=1440)


class MeetingReminderSettingUpdate(BaseModel):
    lead_minutes: int = Field(..., ge=1, le=1440)


class ToastDurationSettingRead(BaseModel):
    duration_seconds: int = Field(..., ge=1, le=60)


class ToastDurationSettingUpdate(BaseModel):
    duration_seconds: int = Field(..., ge=1, le=60)


class NotificationSoundSettingRead(BaseModel):
    sound_key: str


class NotificationSoundSettingUpdate(BaseModel):
    sound_key: str = Field(..., min_length=1, max_length=40)


class NotificationVolumeRead(BaseModel):
    volume_percent: int = Field(..., ge=0, le=100)


class NotificationVolumeUpdate(BaseModel):
    volume_percent: int = Field(..., ge=0, le=100)
