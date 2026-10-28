import uuid

from sqlalchemy import Column, DateTime, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base
from app.shared.mixins import OrganizationScopedMixin


class AuditEvent(Base, OrganizationScopedMixin):
    """Append-only record of an authenticated API write request."""

    __tablename__ = "audit_events"
    __table_args__ = (Index("ix_audit_events_org_created", "organization_id", "created_at"),)

    event_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    actor_name = Column(String(255), nullable=False)
    actor_roles = Column(String(500), nullable=False, default="User")
    method = Column(String(10), nullable=False)
    path = Column(String(500), nullable=False)
    status_code = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
