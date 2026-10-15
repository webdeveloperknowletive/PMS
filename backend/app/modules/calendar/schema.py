import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class CalendarEventBase(BaseModel):
    project_id: uuid.UUID
    organizer: uuid.UUID | None = None
    title: str = Field(..., max_length=255)
    description: str | None = None
    event_type: str = Field(..., max_length=50)
    start_datetime: datetime
    end_datetime: datetime
    location: str | None = Field(None, max_length=255)
    calendar_scope: str = Field("ORGANIZATION", pattern="^(ORGANIZATION|PERSONAL)$")
    calendar_owner_id: uuid.UUID | None = None
    related_task_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def _check_datetime_range(self):
        if self.end_datetime < self.start_datetime:
            raise ValueError("end_datetime must be on or after start_datetime")
        if self.calendar_scope == "PERSONAL" and self.calendar_owner_id is None:
            raise ValueError("Personal calendar events need an owner")
        if self.calendar_scope == "ORGANIZATION" and self.calendar_owner_id is not None:
            raise ValueError("Organization calendar events cannot have a personal owner")
        return self


class CalendarEventCreate(CalendarEventBase):
    pass


class CalendarEventUpdate(BaseModel):
    title: str | None = Field(None, max_length=255)
    description: str | None = None
    event_type: str | None = Field(None, max_length=50)
    start_datetime: datetime | None = None
    end_datetime: datetime | None = None
    location: str | None = Field(None, max_length=255)


class CalendarEventRead(CalendarEventBase):
    model_config = ConfigDict(from_attributes=True)

    event_id: uuid.UUID
    created_at: datetime
    is_automatic: bool = False
