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
