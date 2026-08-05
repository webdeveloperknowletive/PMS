import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class TeamLeadBase(BaseModel):
    user_id: uuid.UUID


class TeamLeadCreate(TeamLeadBase):
    pass


class TeamLeadRead(TeamLeadBase):
    model_config = ConfigDict(from_attributes=True)

    team_lead_id: uuid.UUID
    created_at: datetime


class TeamBase(BaseModel):
    project_id: uuid.UUID
    team_lead_id: uuid.UUID
    team_name: str = Field(..., max_length=150)
    description: str | None = None
    max_members: int = Field(10, gt=0)
    status: str = Field("ACTIVE", max_length=20)


class TeamCreate(TeamBase):
    pass


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
