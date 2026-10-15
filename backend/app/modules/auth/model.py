import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base
from app.shared.mixins import OrganizationScopedMixin


# ==========================================================
# Refresh Tokens
# ==========================================================

class RefreshToken(Base, OrganizationScopedMixin):
    __tablename__ = "refresh_tokens"

    refresh_token_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    token = Column(
        String(512),
        nullable=False,
        unique=True,
    )

    expires_at = Column(
        DateTime(timezone=True),
        nullable=False,
    )

    is_revoked = Column(
        Boolean,
        default=False,
        nullable=False,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    user = relationship(
        "User",
        back_populates="refresh_tokens",
    )


# ==========================================================
# Password Reset Tokens
# ==========================================================

class PasswordResetToken(Base, OrganizationScopedMixin):
    __tablename__ = "password_reset_tokens"

    password_reset_token_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    token = Column(
        String(512),
        nullable=False,
        unique=True,
    )

    expires_at = Column(
        DateTime(timezone=True),
        nullable=False,
    )

    is_used = Column(
        Boolean,
        default=False,
        nullable=False,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    user = relationship(
        "User",
        back_populates="password_reset_tokens",
    )


# ==========================================================
# Email Verification Tokens
# ==========================================================

class EmailVerificationToken(Base, OrganizationScopedMixin):
    __tablename__ = "email_verification_tokens"

    email_verification_token_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    token = Column(
        String(512),
        nullable=False,
        unique=True,
    )

    expires_at = Column(
        DateTime(timezone=True),
        nullable=False,
    )

    is_used = Column(
        Boolean,
        default=False,
        nullable=False,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    user = relationship(
        "User",
        back_populates="email_verification_tokens",
    )


# ==========================================================
# Login History
# ==========================================================

class LoginHistory(Base, OrganizationScopedMixin):
    __tablename__ = "login_history"

    login_history_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    ip_address = Column(
        String(50),
        nullable=True,
    )

    user_agent = Column(
        String(500),
        nullable=True,
    )

    login_time = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    logout_time = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    is_successful = Column(
        Boolean,
        default=True,
        nullable=False,
    )

    user = relationship(
        "User",
        back_populates="login_history",
    )