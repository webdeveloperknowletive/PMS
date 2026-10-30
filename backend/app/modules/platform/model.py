import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base


class PlatformAdmin(Base):
    """Developer-company account; intentionally not organization-scoped."""

    __tablename__ = "platform_admins"

    platform_admin_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(150), nullable=False)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    is_email_verified = Column(Boolean, nullable=False, default=True, server_default="true")
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class PlatformAdminSession(Base):
    __tablename__ = "platform_admin_sessions"

    session_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    platform_admin_id = Column(UUID(as_uuid=True), ForeignKey("platform_admins.platform_admin_id", ondelete="CASCADE"), nullable=False, index=True)
    refresh_token_hash = Column(String(128), nullable=False, unique=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
