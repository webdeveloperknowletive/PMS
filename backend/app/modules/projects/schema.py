import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.modules.projects.constants import PROJECT_STATUSES


def _validate_status(value: str | None) -> str | None:
    if value is not None and value not in PROJECT_STATUSES:
        raise ValueError(f"status must be one of: {', '.join(PROJECT_STATUSES)}")
    return value


class ProjectBase(BaseModel):
    project_name: str = Field(..., max_length=200)
    description: str | None = None
    status: str = Field("ACTIVE", max_length=20)
    priority: str = Field("MEDIUM", max_length=20)
    start_date: date | None = None
    due_date: date | None = None

    @field_validator("status")
    @classmethod
    def check_status(cls, value: str) -> str:
        return _validate_status(value)

    @field_validator("priority")
    @classmethod
    def check_priority(cls, value: str) -> str:
        value = value.upper()
        if value not in {"LOW", "MEDIUM", "HIGH", "URGENT"}:
            raise ValueError("priority must be LOW, MEDIUM, HIGH, or URGENT")
        return value

    @model_validator(mode="after")
    def check_dates(self):
        if self.start_date and self.due_date and self.due_date < self.start_date:
            raise ValueError("Due date must be on or after the start date")
        return self


class ProjectCreate(ProjectBase):
    team_lead_user_id: uuid.UUID
    project_manager_user_id: uuid.UUID
    team_member_user_ids: list[uuid.UUID] = Field(default_factory=list)

    @model_validator(mode="after")
    def check_team_setup(self):
        if len(self.team_member_user_ids) != len(set(self.team_member_user_ids)):
            raise ValueError("Team members must be unique")
        return self


class ProjectUpdate(BaseModel):
    project_name: str | None = Field(None, max_length=200)
    description: str | None = None
    status: str | None = Field(None, max_length=20)
    priority: str | None = Field(None, max_length=20)
    start_date: date | None = None
    due_date: date | None = None

    @field_validator("status")
    @classmethod
    def check_status(cls, value: str | None) -> str | None:
        return _validate_status(value)

    @field_validator("priority")
    @classmethod
    def check_priority(cls, value: str | None) -> str | None:
        if value is not None and value.upper() not in {"LOW", "MEDIUM", "HIGH", "URGENT"}:
            raise ValueError("priority must be LOW, MEDIUM, HIGH, or URGENT")
        return value.upper() if value else value

    @model_validator(mode="after")
    def check_dates(self):
        if self.start_date and self.due_date and self.due_date < self.start_date:
            raise ValueError("Due date must be on or after the start date")
        return self


class ProjectRead(ProjectBase):
    model_config = ConfigDict(from_attributes=True)

    project_id: uuid.UUID
    project_manager_user_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime


class ProjectAssignmentCandidateRead(BaseModel):
    user_id: uuid.UUID
    name: str
    role_names: list[str]
    is_active: bool
