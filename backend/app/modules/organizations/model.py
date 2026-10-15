import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Organization(Base):
    __tablename__ = "organizations"

    organization_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(180), nullable=False)
    slug = Column(String(80), nullable=False, unique=True, index=True)
    status = Column(String(24), nullable=False, default="ACTIVE", server_default="ACTIVE")
    plan_code = Column(String(32), nullable=False, default="TRIAL", server_default="TRIAL")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    invitations = relationship("OrganizationInvitation", back_populates="organization", cascade="all, delete-orphan")
    subscription = relationship("OrganizationSubscription", back_populates="organization", uselist=False, cascade="all, delete-orphan")


class OrganizationSubscription(Base):
    """Provider-neutral billing record, ready to connect to a payment service."""

    __tablename__ = "organization_subscriptions"

    subscription_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.organization_id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    billing_provider = Column(String(32), nullable=False, default="none", server_default="none")
    provider_customer_id = Column(String(160), nullable=True, unique=True)
    provider_subscription_id = Column(String(160), nullable=True, unique=True)
    plan_code = Column(String(32), nullable=False, default="TRIAL", server_default="TRIAL")
    status = Column(String(24), nullable=False, default="TRIALING", server_default="TRIALING")
    trial_ends_at = Column(DateTime(timezone=True), nullable=True)
    period_ends_at = Column(DateTime(timezone=True), nullable=True)
    cancel_at_period_end = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    organization = relationship("Organization", back_populates="subscription")


class OrganizationInvitation(Base):
    __tablename__ = "organization_invitations"

    invitation_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.organization_id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(255), nullable=False, index=True)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.role_id", ondelete="RESTRICT"), nullable=False)
    invited_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    organization = relationship("Organization", back_populates="invitations")
