import uuid

from sqlalchemy import Boolean, Column, Date, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.shared.mixins import CreatedAtMixin


class Milestone(Base, CreatedAtMixin):
    __tablename__ = "milestones"

    milestone_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    due_date = Column(Date, nullable=False, index=True)
    is_completed = Column(Boolean, nullable=False, default=False)

    project = relationship("Project", back_populates="milestones")

    def __repr__(self) -> str:
        return f"<Milestone {self.title}>"
