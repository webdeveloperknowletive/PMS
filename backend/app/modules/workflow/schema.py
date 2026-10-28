import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.modules.workflow.transitions import default_task_transitions, validate_task_transitions


class WorkflowBase(BaseModel):
    project_id: uuid.UUID
    team_lead_id: uuid.UUID
    workflow_name: str = Field(..., max_length=100)
    description: str | None = None
    workflow_type: str = Field("Task Workflow", max_length=50)
    is_default: bool = False
    status: str = Field("ACTIVE", max_length=20)
    allowed_transitions: dict[str, list[str]] = Field(default_factory=default_task_transitions)

    @field_validator("allowed_transitions")
    @classmethod
    def validate_allowed_transitions(cls, value: dict[str, list[str]]) -> dict[str, list[str]]:
        return validate_task_transitions(value)


class WorkflowCreate(WorkflowBase):
    pass


class WorkflowUpdate(BaseModel):
    team_lead_id: uuid.UUID | None = None
    workflow_name: str | None = Field(None, max_length=100)
    description: str | None = None
    workflow_type: str | None = Field(None, max_length=50)
    is_default: bool | None = None
    status: str | None = Field(None, max_length=20)
    allowed_transitions: dict[str, list[str]] | None = None

    @field_validator("allowed_transitions")
    @classmethod
    def validate_allowed_transitions(cls, value: dict[str, list[str]] | None) -> dict[str, list[str]] | None:
        if value is None:
            raise ValueError("Allowed transitions cannot be null")
        return validate_task_transitions(value)


class WorkflowRead(WorkflowBase):
    model_config = ConfigDict(from_attributes=True)

    workflow_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
