import uuid

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class CalendarEvent(Base):
    __tablename__ = "calendar_events"
    __table_args__ = (
        CheckConstraint("end_datetime >= start_datetime", name="ck_calendar_events_datetime_range"),
    )

    event_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False, index=True)
    organizer = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    event_type = Column(String(50), nullable=False)
    start_datetime = Column(DateTime(timezone=True), nullable=False, index=True)
    end_datetime = Column(DateTime(timezone=True), nullable=False)
    location = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    project = relationship("Project", back_populates="calendar_events")
    organizer_user = relationship("User", back_populates="organized_calendar_events")

    def __repr__(self) -> str:
        return f"<CalendarEvent {self.title}>"
