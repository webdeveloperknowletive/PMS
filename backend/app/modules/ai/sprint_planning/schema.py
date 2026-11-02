import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AISprintPlanBase(BaseModel):
    project_id: uuid.UUID
    generated_by: uuid.UUID | None = None
    sprint_name: str = Field(..., max_length=150)
    sprint_goal: str
    sprint_duration_days: int = Field(..., gt=0)
    suggested_tasks: list[Any] = Field(default_factory=list)
    estimated_story_points: int | None = None
    ai_model: str = Field(..., max_length=100)
    prompt: str
    ai_response: dict[str, Any]
    confidence_score: Decimal | None = Field(None, ge=0, le=100)
    status: str = Field("Generated", max_length=30)


class AISprintPlanCreate(AISprintPlanBase):
    pass


class AISprintPlanUpdate(BaseModel):
    sprint_name: str | None = Field(None, max_length=150)
    sprint_goal: str | None = None
    sprint_duration_days: int | None = Field(None, gt=0)
    suggested_tasks: list[Any] | None = None
    estimated_story_points: int | None = None
    status: str | None = Field(None, max_length=30)


class AISprintPlanGenerationRequest(BaseModel):
    project_id: uuid.UUID
    sprint_name: str = Field(..., max_length=150)
    sprint_goal: str
    sprint_duration_days: int = Field(..., gt=0)
    prompt: str = ""


class AISprintPlanApplyRequest(BaseModel):
    selected_task_ids: list[uuid.UUID] = Field(..., min_length=1, max_length=100)

    @field_validator("selected_task_ids")
    @classmethod
    def unique_task_ids(cls, value):
        if len(value) != len(set(value)):
            raise ValueError("Choose each suggested task only once")
        return value


class AISprintPlanRead(AISprintPlanBase):
    model_config = ConfigDict(from_attributes=True)

    sprint_plan_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    applied_sprint_id: uuid.UUID | None = None
