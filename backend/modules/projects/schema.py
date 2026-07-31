import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ProjectBase(BaseModel):
    project_name: str = Field(..., max_length=200)
    description: str | None = None
    status: str = Field("ACTIVE", max_length=20)


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    project_name: str | None = Field(None, max_length=200)
    description: str | None = None
    status: str | None = Field(None, max_length=20)


class ProjectRead(ProjectBase):
    model_config = ConfigDict(from_attributes=True)

    project_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
