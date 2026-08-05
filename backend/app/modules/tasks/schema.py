import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class TaskBase(BaseModel):
    project_id: uuid.UUID
    user_id: uuid.UUID | None = None
    sprint_plan_id: uuid.UUID | None = None
    parent_task_id: uuid.UUID | None = None
    task_name: str = Field(..., max_length=255)
    description: str | None = None
    status: str = Field("TODO", max_length=20)
    priority: str = Field("MEDIUM", max_length=20)
    due_date: date | None = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    user_id: uuid.UUID | None = None
    sprint_plan_id: uuid.UUID | None = None
    parent_task_id: uuid.UUID | None = None
    task_name: str | None = Field(None, max_length=255)
    description: str | None = None
    status: str | None = Field(None, max_length=20)
    priority: str | None = Field(None, max_length=20)
    due_date: date | None = None


class TaskRead(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    task_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
