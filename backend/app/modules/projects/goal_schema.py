from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ProjectGoalCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150, str_strip_whitespace=True)
    description: str | None = Field(None, max_length=5000, str_strip_whitespace=True)
    success_measure: str | None = Field(None, max_length=2000, str_strip_whitespace=True)
    owner_id: UUID | None = None
    parent_goal_id: UUID | None = None
    status: Literal["ACTIVE", "AT_RISK", "COMPLETED", "CANCELLED"] = "ACTIVE"
    target_date: date | None = None


class ProjectGoalUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=150, str_strip_whitespace=True)
    description: str | None = Field(None, max_length=5000, str_strip_whitespace=True)
    success_measure: str | None = Field(None, max_length=2000, str_strip_whitespace=True)
    owner_id: UUID | None = None
    parent_goal_id: UUID | None = None
    status: Literal["ACTIVE", "AT_RISK", "COMPLETED", "CANCELLED"] | None = None
    target_date: date | None = None

    @model_validator(mode="after")
    def _reject_null_required_values(self):
        for field in ("name", "status"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be cleared")
        return self


class ProjectGoalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    goal_id: UUID
    project_id: UUID
    name: str
    description: str | None
    success_measure: str | None
    owner_id: UUID | None
    owner_name: str | None = None
    parent_goal_id: UUID | None
    status: str
    target_date: date | None
    task_count: int = 0
    completed_task_count: int = 0
    progress_percent: int = 0
    created_at: datetime
    updated_at: datetime


class ProjectGoalPortfolioRead(ProjectGoalRead):
    project_name: str
