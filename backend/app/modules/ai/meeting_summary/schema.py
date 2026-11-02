import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


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


class AIMeetingSummaryGenerationRequest(BaseModel):
    project_id: uuid.UUID
    meeting_title: str = Field(..., max_length=255)
    meeting_date: datetime
    transcript: str


class AIMeetingSummaryRead(AIMeetingSummaryBase):
    model_config = ConfigDict(from_attributes=True)

    summary_id: uuid.UUID
    created_at: datetime
    applied_action_items: list[int] = Field(default_factory=list)


class AIMeetingApplyRequest(BaseModel):
    item_indexes: list[int] = Field(..., min_length=1, max_length=100)

    @field_validator("item_indexes")
    @classmethod
    def unique_indexes(cls, value):
        if any(index < 0 for index in value) or len(value) != len(set(value)):
            raise ValueError("Choose each action item once")
        return value
