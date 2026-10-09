import uuid
from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class ChatContactRead(BaseModel):
    user_id: uuid.UUID
    name: str
    email: str
    profile_picture_url: str | None = None
    roles: list[str]


class ChatMessageCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=4000)
    reply_to_message_id: uuid.UUID | None = None


class ChatReactionUpdate(BaseModel):
    emoji: str = Field(..., min_length=1, max_length=16)


class ChatReactionRead(BaseModel):
    emoji: str
    count: int
    reacted: bool


class ChatMessageRead(BaseModel):
    message_id: uuid.UUID
    conversation_id: uuid.UUID
    sender_id: uuid.UUID
    sender_name: str
    sender_roles: list[str]
    body: str
    message_type: str = "TEXT"
    attachment_name: str | None = None
    attachment_url: str | None = None
    sender_profile_picture_url: str | None = None
    reply_to_message_id: uuid.UUID | None = None
    reply_to_sender_name: str | None = None
    reply_to_body: str | None = None
    reactions: list[ChatReactionRead] = Field(default_factory=list)
    sent_at: datetime


class ChatConversationRead(BaseModel):
    conversation_id: uuid.UUID
    conversation_type: str
    name: str
    created_by_user_id: uuid.UUID
    peer_user_id: uuid.UUID | None = None
    peer_profile_picture_url: str | None = None
    team_id: uuid.UUID | None
    team_name: str | None
    member_count: int
    members: list[ChatContactRead] = Field(default_factory=list)
    unread_count: int
    is_favorite: bool = False
    last_message: ChatMessageRead | None
    created_at: datetime


class ChatGroupCreate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=150)
    member_ids: list[uuid.UUID] = Field(default_factory=list, max_length=200)
    team_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def validate_group(self):
        if self.team_id is None and (not self.name or not self.member_ids):
            raise ValueError("A group name and at least one member are required.")
        if len(set(self.member_ids)) != len(self.member_ids):
            raise ValueError("Group members must be unique.")
        return self


class ChatSettingsRead(BaseModel):
    notifications_enabled: bool
    volume_percent: int = Field(..., ge=0, le=100)
    font_size: str = "medium"
    theme: str = "light"


class ChatSettingsUpdate(BaseModel):
    notifications_enabled: bool
    volume_percent: int = Field(..., ge=0, le=100)
    font_size: str = Field("medium", pattern="^(small|medium|large)$")
    theme: str = Field("light", pattern="^(light|dark)$")


class ChatFavoriteUpdate(BaseModel):
    is_favorite: bool


class ChatFavoriteRead(BaseModel):
    is_favorite: bool


class ChatOrganizationSettingsRead(BaseModel):
    sound_key: str
    master_volume_percent: int = Field(..., ge=0, le=150)


class ChatOrganizationSettingsUpdate(BaseModel):
    sound_key: str = Field(..., min_length=1, max_length=40)
    master_volume_percent: int = Field(..., ge=0, le=150)
