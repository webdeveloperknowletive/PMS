import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.shared.mixins import OrganizationScopedMixin
from app.shared.mixins import CreatedAtMixin


class AIMeetingSummary(Base, OrganizationScopedMixin, CreatedAtMixin):
    __tablename__ = "ai_meeting_summaries"

    summary_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True, index=True)
    meeting_title = Column(String(255), nullable=False)
    meeting_date = Column(DateTime(timezone=True), nullable=False, index=True)
    transcript = Column(Text, nullable=False)
    summary = Column(Text, nullable=False)
    action_items = Column(JSONB, nullable=False, default=list)
    decisions = Column(JSONB, nullable=True, default=list)
    attendees = Column(JSONB, nullable=True, default=list)
    ai_model = Column(String(100), nullable=False)

    project = relationship("Project", back_populates="meeting_summaries")
    created_by_user = relationship("User", back_populates="meeting_summaries")

    def __repr__(self) -> str:
        return f"<AIMeetingSummary {self.meeting_title}>"
