from pydantic import BaseModel, EmailStr, Field
from app.modules.organizations.schema import WorkspaceUpdate


class PlatformWorkspaceCreate(WorkspaceUpdate):
    owner_email: EmailStr


class WorkspaceDelete(BaseModel):
    confirmation_slug: str = Field(min_length=3, max_length=63)
