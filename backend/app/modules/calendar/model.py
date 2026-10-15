import uuid

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base
from app.shared.mixins import OrganizationScopedMixin


class CalendarEvent(Base, OrganizationScopedMixin):
    __tablename__ = "calendar_events"
    __table_args__ = (
        CheckConstraint("end_datetime >= start_datetime", name="ck_calendar_events_datetime_range"),
        CheckConstraint(
            "(calendar_scope = 'ORGANIZATION' AND calendar_owner_id IS NULL) OR "
            "(calendar_scope = 'PERSONAL' AND calendar_owner_id IS NOT NULL)",
            name="ck_calendar_events_scope_owner",
        ),
    )

    event_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False, index=True)
    organizer = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True, index=True)
    calendar_scope = Column(String(20), nullable=False, default="ORGANIZATION", index=True)
    calendar_owner_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=True, index=True)
    related_task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.task_id", ondelete="CASCADE"), nullable=True, index=True)
    is_automatic = Column(Boolean, nullable=False, default=False, server_default="false")
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    event_type = Column(String(50), nullable=False)
    start_datetime = Column(DateTime(timezone=True), nullable=False, index=True)
    end_datetime = Column(DateTime(timezone=True), nullable=False)
    location = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    project = relationship("Project", back_populates="calendar_events")
    organizer_user = relationship("User", foreign_keys=[organizer], back_populates="organized_calendar_events")
    calendar_owner = relationship("User", foreign_keys=[calendar_owner_id])

    def __repr__(self) -> str:
        return f"<CalendarEvent {self.title}>"
