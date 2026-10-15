import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class TeamLeadBase(BaseModel):
    user_id: uuid.UUID


class TeamLeadCreate(TeamLeadBase):
    pass


class TeamLeadRead(TeamLeadBase):
    model_config = ConfigDict(from_attributes=True)

    team_lead_id: uuid.UUID
    created_at: datetime


class TeamMemberCandidateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: uuid.UUID
    name: str
    is_active: bool
    role_names: list[str] = Field(default_factory=list)


class TeamBase(BaseModel):
    project_id: uuid.UUID
    team_lead_id: uuid.UUID
    team_name: str = Field(..., max_length=150)
    description: str | None = None
    max_members: int = Field(10, gt=0)
    status: str = Field("ACTIVE", max_length=20)


class TeamCreate(TeamBase):
    member_user_ids: list[uuid.UUID] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_initial_members(self):
        if len(self.member_user_ids) != len(set(self.member_user_ids)):
            raise ValueError("Team members must be unique")
        if len(self.member_user_ids) > self.max_members:
            raise ValueError("Initial team members cannot exceed the team capacity")
        return self


class TeamUpdate(BaseModel):
    team_lead_id: uuid.UUID | None = None
    team_name: str | None = Field(None, max_length=150)
    description: str | None = None
    max_members: int | None = Field(None, gt=0)
    status: str | None = Field(None, max_length=20)


class TeamRead(TeamBase):
    model_config = ConfigDict(from_attributes=True)

    team_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    members: list["TeamMemberRead"] = Field(default_factory=list)


class TeamMemberBase(BaseModel):
    team_id: uuid.UUID
    user_id: uuid.UUID
    responsibility: str | None = Field(None, max_length=100)


class TeamMemberCreate(TeamMemberBase):
    pass


class TeamMemberUpdate(BaseModel):
    responsibility: str | None = Field(None, max_length=100)


class TeamMemberRead(TeamMemberBase):
    model_config = ConfigDict(from_attributes=True)

    member_id: uuid.UUID
    joined_at: date


TeamRead.model_rebuild()
