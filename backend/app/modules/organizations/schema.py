from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class WorkspaceOwnerCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    organization_name: str = Field(min_length=2, max_length=180)
    workspace_slug: str = Field(min_length=3, max_length=63, pattern=r"^[a-z0-9](?:[a-z0-9-]*[a-z0-9])$")
    accepted_terms: bool

    @field_validator("name", "organization_name")
    @classmethod
    def trim_required_names(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Enter at least 2 characters")
        return value

    @field_validator("workspace_slug")
    @classmethod
    def normalize_workspace_slug(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("accepted_terms")
    @classmethod
    def terms_must_be_accepted(cls, value: bool) -> bool:
        if not value:
            raise ValueError("Accept the Terms of Service to create a workspace")
        return value


class WorkspaceUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=180)
    slug: str = Field(min_length=3, max_length=63, pattern=r"^[a-z0-9](?:[a-z0-9-]*[a-z0-9])$")

    @field_validator("name")
    @classmethod
    def trim_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Organization name must contain at least 2 characters")
        return value

    @field_validator("slug")
    @classmethod
    def normalize_slug(cls, value: str) -> str:
        return value.strip().lower()


class WorkspaceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    organization_id: UUID
    name: str
    slug: str
    status: str
    plan_code: str
    created_at: datetime
    subscription_status: str | None = None
    trial_ends_at: datetime | None = None


class WorkspaceRegistrationRead(BaseModel):
    user_id: UUID
    organization: WorkspaceRead
    verification_required: bool = True
    verification_email_sent: bool = False
    verification_url: str | None = None


class WorkspaceInviteCreate(BaseModel):
    email: EmailStr
    role_id: UUID


class WorkspaceInviteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    invitation_id: UUID
    email: EmailStr
    role_id: UUID
    created_at: datetime
    expires_at: datetime
    accepted_at: datetime | None = None
    revoked_at: datetime | None = None
    invitation_url: str | None = None
    email_sent: bool = False


class InvitationPreviewRead(BaseModel):
    organization_name: str
    organization_slug: str
    email: EmailStr
    role_name: str
    expires_at: datetime


class InvitationAccept(BaseModel):
    token: str = Field(min_length=20, max_length=256)
    name: str = Field(min_length=2, max_length=150)
    password: str = Field(min_length=8, max_length=128)
    accepted_terms: bool

    @field_validator("name")
    @classmethod
    def trim_member_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Enter at least 2 characters for your name")
        return value

    @field_validator("accepted_terms")
    @classmethod
    def terms_must_be_accepted(cls, value: bool) -> bool:
        if not value:
            raise ValueError("Accept the Terms of Service to join the workspace")
        return value


class InvitationAcceptRead(BaseModel):
    user_id: UUID
    organization: WorkspaceRead
