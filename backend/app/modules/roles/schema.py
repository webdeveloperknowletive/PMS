import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class RoleBase(BaseModel):
    role_name: str = Field(..., max_length=100)
    description: str | None = Field(None, max_length=255)


class RoleCreate(RoleBase):
    pass


class RoleUpdate(BaseModel):
    role_name: str | None = Field(None, max_length=100)
    description: str | None = Field(None, max_length=255)


class RoleRead(RoleBase):
    model_config = ConfigDict(from_attributes=True)

    role_id: uuid.UUID
    created_at: datetime


class UserRoleBase(BaseModel):
    user_id: uuid.UUID
    role_id: uuid.UUID


class UserRoleCreate(UserRoleBase):
    pass


class UserRoleRead(UserRoleBase):
    model_config = ConfigDict(from_attributes=True)

    user_role_id: uuid.UUID
    assigned_at: datetime


class PermissionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    permission_id: uuid.UUID
    code: str
    name: str
    description: str
    category: str


class RolePermissionsUpdate(BaseModel):
    permission_ids: list[uuid.UUID]
