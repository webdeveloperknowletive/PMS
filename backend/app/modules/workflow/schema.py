import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class WorkflowBase(BaseModel):
    project_id: uuid.UUID
    team_lead_id: uuid.UUID
    workflow_name: str = Field(..., max_length=100)
    description: str | None = None
    workflow_type: str = Field("Task Workflow", max_length=50)
    is_default: bool = False
    status: str = Field("ACTIVE", max_length=20)


class WorkflowCreate(WorkflowBase):
    pass


class WorkflowUpdate(BaseModel):
    team_lead_id: uuid.UUID | None = None
    workflow_name: str | None = Field(None, max_length=100)
    description: str | None = None
    workflow_type: str | None = Field(None, max_length=50)
    is_default: bool | None = None
    status: str | None = Field(None, max_length=20)


class WorkflowRead(WorkflowBase):
    model_config = ConfigDict(from_attributes=True)

    workflow_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
