import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class AIMeetingSummaryBase(BaseModel):
    project_id: uuid.UUID
    created_by: uuid.UUID | None = None
    meeting_title: str = Field(..., max_length=255)
    meeting_date: datetime
    transcript: str
    summary: str
    action_items: list[Any] = Field(default_factory=list)
    decisions: list[Any] | None = Field(default_factory=list)
    attendees: list[Any] | None = Field(default_factory=list)
    ai_model: str = Field(..., max_length=100)


class AIMeetingSummaryCreate(AIMeetingSummaryBase):
    pass


class AIMeetingSummaryUpdate(BaseModel):
    meeting_title: str | None = Field(None, max_length=255)
    summary: str | None = None
    action_items: list[Any] | None = None
    decisions: list[Any] | None = None
    attendees: list[Any] | None = None


class AIMeetingSummaryRead(AIMeetingSummaryBase):
    model_config = ConfigDict(from_attributes=True)

    summary_id: uuid.UUID
    created_at: datetime
