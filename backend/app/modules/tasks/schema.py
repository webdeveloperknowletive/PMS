import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class TaskChecklistItem(BaseModel):
    item_id: str = Field(..., min_length=1, max_length=80)
    text: str = Field(..., min_length=1, max_length=255)
    is_completed: bool = False


class TaskBase(BaseModel):
    project_id: uuid.UUID
    team_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None
    sprint_plan_id: uuid.UUID | None = None
    parent_task_id: uuid.UUID | None = None
    sprint_id: uuid.UUID | None = None
    task_name: str = Field(..., max_length=255)
    description: str | None = None
    task_type: Literal["EPIC", "STORY", "TASK", "BUG", "SUBTASK"] = "TASK"
    story_points: int | None = Field(None, ge=0, le=100)
    status: str = Field("TODO", max_length=20)
    priority: str = Field("MEDIUM", max_length=20)
    due_date: date | None = None
    checklist_items: list[TaskChecklistItem] = Field(default_factory=list)


class TaskCreate(TaskBase):
    kanban_column_id: uuid.UUID | None = None
    kanban_position: int | None = Field(None, ge=0)


class TaskUpdate(BaseModel):
    user_id: uuid.UUID | None = None
    sprint_plan_id: uuid.UUID | None = None
    parent_task_id: uuid.UUID | None = None
    sprint_id: uuid.UUID | None = None
    task_name: str | None = Field(None, max_length=255)
    description: str | None = None
    task_type: Literal["EPIC", "STORY", "TASK", "BUG", "SUBTASK"] | None = None
    story_points: int | None = Field(None, ge=0, le=100)
    status: str | None = Field(None, max_length=20)
    priority: str | None = Field(None, max_length=20)
    due_date: date | None = None
    checklist_items: list[TaskChecklistItem] = Field(default_factory=list)


class TaskRead(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    task_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    assignee_name: str | None = None


class SprintCreate(BaseModel):
    project_id: uuid.UUID
    sprint_name: str = Field(..., min_length=2, max_length=150)
    goal: str | None = None
    start_date: date | None = None
    end_date: date | None = None


class SprintUpdate(BaseModel):
    sprint_name: str | None = Field(None, min_length=2, max_length=150)
    goal: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: Literal["PLANNED", "ACTIVE", "COMPLETED"] | None = None


class SprintRead(SprintCreate):
    model_config = ConfigDict(from_attributes=True)

    sprint_id: uuid.UUID
    status: str
    created_by: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime


class TaskCommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=10000)


class TaskCommentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    comment_id: uuid.UUID
    task_id: uuid.UUID
    author_id: uuid.UUID | None
    content: str
    created_at: datetime
    author_name: str | None = None


class TaskActivityRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    activity_id: uuid.UUID
    task_id: uuid.UUID
    actor_id: uuid.UUID | None
    event_type: str
    details: str
    created_at: datetime
    actor_name: str | None = None


class WorkSessionStart(BaseModel):
    task_ids: list[uuid.UUID] = Field(..., min_length=1, max_length=25)


class WorkSessionRead(BaseModel):
    work_session_id: uuid.UUID
    user_id: uuid.UUID
    user_name: str
    started_at: datetime
    ended_at: datetime | None
    duration_seconds: int
    is_running: bool
    task_ids: list[uuid.UUID]
    task_names: list[str]


class TaskWorkTimeRead(BaseModel):
    task_id: uuid.UUID
    duration_seconds: int
    is_tracking: bool
    active_since: datetime | None = None
