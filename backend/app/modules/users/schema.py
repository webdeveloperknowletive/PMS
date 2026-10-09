import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserBase(BaseModel):
    name: str = Field(..., max_length=150)
    email: EmailStr = Field(..., max_length=255)
    is_active: bool = True


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, description="Plain-text password; hashed by the service layer.")


class UserUpdate(BaseModel):
    name: str | None = Field(None, max_length=150)
    email: EmailStr | None = Field(None, max_length=255)
    is_active: bool | None = None


class UserRead(UserBase):
    model_config = ConfigDict(from_attributes=True)

    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    profile_picture_url: str | None = None


class UserInDB(UserRead):
    """Internal-only representation; never return this from an API response."""

    password_hash: str
