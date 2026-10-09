import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base


class ChatConversation(Base):
    __tablename__ = "chat_conversations"
    __table_args__ = (UniqueConstraint("team_id", name="uq_chat_conversations_team"),)

    conversation_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_type = Column(String(16), nullable=False)
    name = Column(String(150), nullable=True)
    team_id = Column(UUID(as_uuid=True), ForeignKey("teams.team_id", ondelete="CASCADE"), nullable=True, index=True)
    direct_key = Column(String(73), unique=True, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class ChatConversationMember(Base):
    __tablename__ = "chat_conversation_members"

    conversation_id = Column(UUID(as_uuid=True), ForeignKey("chat_conversations.conversation_id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), primary_key=True, index=True)
    joined_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_read_at = Column(DateTime(timezone=True), nullable=True)


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    __table_args__ = (Index("ix_chat_messages_conversation_sent", "conversation_id", "sent_at"),)

    message_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("chat_conversations.conversation_id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    body = Column(Text, nullable=False)
    message_type = Column(String(20), nullable=False, default="TEXT", server_default="TEXT")
    attachment_filename = Column(String(255), nullable=True)
    attachment_mime_type = Column(String(255), nullable=True)
    attachment_original_name = Column(String(255), nullable=True)
    reply_to_message_id = Column(UUID(as_uuid=True), ForeignKey("chat_messages.message_id", ondelete="SET NULL"), nullable=True, index=True)
    sent_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class ChatMessageReaction(Base):
    __tablename__ = "chat_message_reactions"
    __table_args__ = (UniqueConstraint("message_id", "user_id", "emoji", name="uq_chat_message_reaction_user"),)

    reaction_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id = Column(UUID(as_uuid=True), ForeignKey("chat_messages.message_id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    emoji = Column(String(16), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class ChatUserSetting(Base):
    __tablename__ = "chat_user_settings"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), primary_key=True)
    notifications_enabled = Column(Boolean, nullable=False, default=True, server_default="true")
    volume_percent = Column(Integer, nullable=False, default=70, server_default="70")
    font_size = Column(String(12), nullable=False, default="medium", server_default="medium")
    theme = Column(String(8), nullable=False, default="light", server_default="light")


class ChatConversationFavorite(Base):
    __tablename__ = "chat_conversation_favorites"
    __table_args__ = (UniqueConstraint("conversation_id", "user_id", name="uq_chat_favorite_user_conversation"),)

    favorite_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("chat_conversations.conversation_id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
