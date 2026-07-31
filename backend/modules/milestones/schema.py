import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class MilestoneBase(BaseModel):
    project_id: uuid.UUID
    title: str = Field(..., max_length=255)
    description: str | None = None
    due_date: date
    is_completed: bool = False


class MilestoneCreate(MilestoneBase):
    pass


class MilestoneUpdate(BaseModel):
    title: str | None = Field(None, max_length=255)
    description: str | None = None
    due_date: date | None = None
    is_completed: bool | None = None


class MilestoneRead(MilestoneBase):
    model_config = ConfigDict(from_attributes=True)

    milestone_id: uuid.UUID
    created_at: datetime
