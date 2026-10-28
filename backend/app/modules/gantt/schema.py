import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class GanttTaskBase(BaseModel):
    project_id: uuid.UUID
    task_id: uuid.UUID
    dependency_task: uuid.UUID | None = None
    start_date: date
    end_date: date
    progress: Decimal = Field(0, ge=0, le=100)

    @model_validator(mode="after")
    def _check_date_range(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class GanttTaskCreate(GanttTaskBase):
    pass


class GanttTaskUpdate(BaseModel):
    dependency_task: uuid.UUID | None = None
    start_date: date | None = None
    end_date: date | None = None
    progress: Decimal | None = Field(None, ge=0, le=100)

    @model_validator(mode="after")
    def _check_date_range_when_both_dates_are_provided(self):
        for field in ("start_date", "end_date", "progress"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be cleared")
        if self.start_date is not None and self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class GanttTaskRead(GanttTaskBase):
    model_config = ConfigDict(from_attributes=True)

    gantt_id: uuid.UUID
    created_at: datetime
