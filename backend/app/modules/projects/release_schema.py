from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ProjectReleaseCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150, str_strip_whitespace=True)
    version: str | None = Field(None, max_length=50, str_strip_whitespace=True)
    status: Literal["PLANNED", "IN_PROGRESS", "RELEASED", "CANCELLED"] = "PLANNED"
    release_date: date | None = None
    notes: str | None = Field(None, max_length=5000, str_strip_whitespace=True)


class ProjectReleaseUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=150, str_strip_whitespace=True)
    version: str | None = Field(None, max_length=50, str_strip_whitespace=True)
    status: Literal["PLANNED", "IN_PROGRESS", "RELEASED", "CANCELLED"] | None = None
    release_date: date | None = None
    notes: str | None = Field(None, max_length=5000, str_strip_whitespace=True)

    @model_validator(mode="after")
    def _reject_null_required_values(self):
        for field in ("name", "status"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be cleared")
        return self


class ProjectReleaseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    release_id: UUID
    project_id: UUID
    name: str
    version: str | None
    status: str
    release_date: date | None
    notes: str | None
    task_count: int = 0
    completed_task_count: int = 0
    unresolved_task_count: int = 0
    created_at: datetime
    updated_at: datetime


class ProjectReleaseScopeChangeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    scope_change_id: UUID
    project_id: UUID
    release_id: UUID
    release_name: str
    task_id: UUID | None
    task_name: str
    actor_id: UUID | None
    actor_name: str | None = None
    event_type: Literal["BASELINE", "ADDED", "REMOVED"]
    created_at: datetime
