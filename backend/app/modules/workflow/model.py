import uuid

from sqlalchemy import Boolean, Column, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.shared.mixins import OrganizationScopedMixin
from app.shared.mixins import TimestampMixin
from app.modules.workflow.transitions import default_task_transitions


class Workflow(Base, OrganizationScopedMixin, TimestampMixin):
    __tablename__ = "workflows"

    workflow_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False, index=True)
    team_lead_id = Column(
        UUID(as_uuid=True),
        ForeignKey("team_leads.team_lead_id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    workflow_name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    workflow_type = Column(String(50), nullable=False, default="Task Workflow")
    is_default = Column(Boolean, nullable=False, default=False)
    status = Column(String(20), nullable=False, default="ACTIVE")
    allowed_transitions = Column(
        JSONB,
        nullable=False,
        default=default_task_transitions,
        server_default=text("'{\"TODO\":[\"IN_PROGRESS\",\"BLOCKED\",\"CANCELLED\"],\"IN_PROGRESS\":[\"TODO\",\"IN_REVIEW\",\"BLOCKED\",\"DONE\",\"CANCELLED\"],\"IN_REVIEW\":[\"IN_PROGRESS\",\"BLOCKED\",\"DONE\"],\"DONE\":[\"IN_PROGRESS\"],\"BLOCKED\":[\"TODO\",\"IN_PROGRESS\",\"CANCELLED\"],\"CANCELLED\":[\"TODO\"]}'::jsonb"),
    )

    project = relationship("Project", back_populates="workflows")
    team_lead = relationship("TeamLead", back_populates="workflows")

    def __repr__(self) -> str:
        return f"<Workflow {self.workflow_name}>"
