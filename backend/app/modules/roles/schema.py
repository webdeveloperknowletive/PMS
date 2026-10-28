import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field
from app.modules.users.schema import UserRead


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
    is_system: bool = False


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


class UserPermissionsRead(BaseModel):
    direct: list[PermissionRead]
    inherited: list[PermissionRead]
    effective: list[PermissionRead]


class UserPermissionsUpdate(BaseModel):
    permission_ids: list[uuid.UUID] = Field(default_factory=list, max_length=1000)


class UserRoleAssignmentsRead(BaseModel):
    user: UserRead
    roles: list[UserRoleRead]
