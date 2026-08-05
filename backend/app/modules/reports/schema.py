import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ReportFormat = Literal["PDF", "Excel", "CSV"]


class ReportBase(BaseModel):
    project_id: uuid.UUID
    generated_by: uuid.UUID | None = None
    report_name: str = Field(..., max_length=255)
    report_type: str = Field(..., max_length=100)
    report_format: ReportFormat
    file_url: str | None = None
    status: str = Field("Completed", max_length=30)


class ReportCreate(ReportBase):
    pass


class ReportUpdate(BaseModel):
    file_url: str | None = None
    status: str | None = Field(None, max_length=30)


class ReportRead(ReportBase):
    model_config = ConfigDict(from_attributes=True)

    report_id: uuid.UUID
    generated_at: datetime
