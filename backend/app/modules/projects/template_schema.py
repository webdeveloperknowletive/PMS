from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProjectTemplateCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, str_strip_whitespace=True)
    board_template: Literal["STANDARD", "SIMPLE", "BLOCKED"] = "STANDARD"


class ProjectTemplateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    template_id: UUID
    name: str
    board_template: Literal["STANDARD", "SIMPLE", "BLOCKED"]
    created_at: datetime
    updated_at: datetime
