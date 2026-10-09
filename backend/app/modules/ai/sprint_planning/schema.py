import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


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


class AISprintPlanRead(AISprintPlanBase):
    model_config = ConfigDict(from_attributes=True)

    sprint_plan_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
