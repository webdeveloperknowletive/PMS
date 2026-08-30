import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.modules.projects.constants import PROJECT_STATUSES


def _validate_status(value: str | None) -> str | None:
    if value is not None and value not in PROJECT_STATUSES:
        raise ValueError(f"status must be one of: {', '.join(PROJECT_STATUSES)}")
    return value


class ProjectBase(BaseModel):
    project_name: str = Field(..., max_length=200)
    description: str | None = None
    status: str = Field("ACTIVE", max_length=20)

    @field_validator("status")
    @classmethod
    def check_status(cls, value: str) -> str:
        return _validate_status(value)


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    project_name: str | None = Field(None, max_length=200)
    description: str | None = None
    status: str | None = Field(None, max_length=20)

    @field_validator("status")
    @classmethod
    def check_status(cls, value: str | None) -> str | None:
        return _validate_status(value)


class ProjectRead(ProjectBase):
    model_config = ConfigDict(from_attributes=True)

    project_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
