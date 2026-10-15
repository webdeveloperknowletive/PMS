import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, PrimaryKeyConstraint, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base
from app.shared.mixins import OrganizationScopedMixin


class Notification(Base, OrganizationScopedMixin):
    __tablename__ = "notifications"

    notification_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=True, index=True)
    chat_conversation_id = Column(UUID(as_uuid=True), ForeignKey("chat_conversations.conversation_id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String(50), nullable=False)
    is_read = Column(Boolean, nullable=False, default=False)
    sent_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    user = relationship("User", back_populates="notifications")
    project = relationship("Project", back_populates="notifications")

    def __repr__(self) -> str:
        return f"<Notification {self.title} user_id={self.user_id}>"


class NotificationSetting(Base, OrganizationScopedMixin):
    __tablename__ = "notification_settings"
    __table_args__ = (PrimaryKeyConstraint("organization_id", "setting_key", name="pk_notification_settings_org_key"),)

    setting_key = Column(String(100), nullable=False)
    setting_value = Column(String(255), nullable=False)


class NotificationUserSetting(Base, OrganizationScopedMixin):
    __tablename__ = "notification_user_settings"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), primary_key=True)
    volume_percent = Column(Integer, nullable=False, default=65, server_default="65")
