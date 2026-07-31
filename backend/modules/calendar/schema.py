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

    @model_validator(mode="after")
    def _check_datetime_range(self):
        if self.end_datetime < self.start_datetime:
            raise ValueError("end_datetime must be on or after start_datetime")
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
