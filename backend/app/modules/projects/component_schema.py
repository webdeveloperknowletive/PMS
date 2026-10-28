import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ProjectComponentCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: str | None = Field(None, max_length=1000)

    @field_validator("name", "description", mode="before")
    @classmethod
    def _strip_text(cls, value):
        return value.strip() if isinstance(value, str) else value


class ProjectComponentUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=100)
    description: str | None = Field(None, max_length=1000)

    @field_validator("name", "description", mode="before")
    @classmethod
    def _strip_text(cls, value):
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def _reject_null_name(self):
        if "name" in self.model_fields_set and self.name is None:
            raise ValueError("name cannot be cleared")
        if not self.model_fields_set:
            raise ValueError("Provide a component field to update")
        return self


class ProjectComponentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    component_id: uuid.UUID
    project_id: uuid.UUID
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime
