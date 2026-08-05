import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class KanbanColumnBase(BaseModel):
    project_id: uuid.UUID
    column_name: str = Field(..., max_length=100)
    position: int
    color: str | None = Field(None, max_length=20)


class KanbanColumnCreate(KanbanColumnBase):
    pass


class KanbanColumnUpdate(BaseModel):
    column_name: str | None = Field(None, max_length=100)
    position: int | None = None
    color: str | None = Field(None, max_length=20)


class KanbanColumnRead(KanbanColumnBase):
    model_config = ConfigDict(from_attributes=True)

    column_id: uuid.UUID
    created_at: datetime


class KanbanTaskBase(BaseModel):
    task_id: uuid.UUID
    column_id: uuid.UUID
    position: int
    moved_by: uuid.UUID | None = None


class KanbanTaskCreate(KanbanTaskBase):
    pass


class KanbanTaskUpdate(BaseModel):
    column_id: uuid.UUID | None = None
    position: int | None = None
    moved_by: uuid.UUID | None = None


class KanbanTaskRead(KanbanTaskBase):
    model_config = ConfigDict(from_attributes=True)

    kanban_task_id: uuid.UUID
    moved_at: datetime
