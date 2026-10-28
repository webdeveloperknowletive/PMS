import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class KanbanColumnBase(BaseModel):
    project_id: uuid.UUID
    column_name: str = Field(..., max_length=100)
    position: int
    color: str | None = Field(None, max_length=20)
    wip_limit: int | None = Field(None, gt=0, le=1000)


class KanbanColumnCreate(KanbanColumnBase):
    pass


class KanbanColumnUpdate(BaseModel):
    column_name: str | None = Field(None, max_length=100)
    position: int | None = None
    color: str | None = Field(None, max_length=20)
    wip_limit: int | None = Field(None, gt=0, le=1000)


class KanbanColumnRead(KanbanColumnBase):
    model_config = ConfigDict(from_attributes=True)

    column_id: uuid.UUID
    created_at: datetime


class KanbanTaskBase(BaseModel):
    task_id: uuid.UUID
    column_id: uuid.UUID
    position: int
    moved_by: uuid.UUID | None = None


class KanbanTaskCreate(KanbanTaskBase):
    pass


class KanbanTaskUpdate(BaseModel):
    column_id: uuid.UUID | None = None
    position: int | None = None
    moved_by: uuid.UUID | None = None


class KanbanTaskRead(KanbanTaskBase):
    model_config = ConfigDict(from_attributes=True)

    kanban_task_id: uuid.UUID
    moved_at: datetime


class KanbanCardDetailsUpdate(BaseModel):
    task_name: str | None = Field(None, min_length=1, max_length=255, str_strip_whitespace=True)
    description: str | None = Field(None, max_length=10000, str_strip_whitespace=True)

    @model_validator(mode="after")
    def _require_update(self):
        if not self.model_fields_set.intersection({"task_name", "description"}):
            raise ValueError("Update the card title or description")
        if "task_name" in self.model_fields_set and self.task_name is None:
            raise ValueError("Card title cannot be empty")
        return self


class KanbanCardMembersUpdate(BaseModel):
    member_ids: list[uuid.UUID] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def _require_unique_members(self):
        if len(self.member_ids) != len(set(self.member_ids)):
            raise ValueError("Card members must be unique")
        return self


class KanbanCardMemberOptionRead(BaseModel):
    user_id: uuid.UUID
    name: str
    profile_picture_url: str | None = None
    is_active: bool = True
    is_eligible: bool = True


class KanbanLabelCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=40, str_strip_whitespace=True)
    color: str = Field("#3B82F6", pattern=r"^#[0-9A-Fa-f]{6}$")

    @model_validator(mode="after")
    def _validate_name(self):
        if not self.name or "," in self.name:
            raise ValueError("Label names must contain text and cannot include commas")
        return self


class KanbanLabelUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=40, str_strip_whitespace=True)
    color: str | None = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")

    @model_validator(mode="after")
    def _validate_update(self):
        if not self.model_fields_set.intersection({"name", "color"}):
            raise ValueError("Update a label name or color")
        if "name" in self.model_fields_set and (self.name is None or not self.name or "," in self.name):
            raise ValueError("Label names must contain text and cannot include commas")
        return self


class KanbanLabelRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    label_id: uuid.UUID
    label_key: str
    name: str
    color: str
    created_at: datetime
