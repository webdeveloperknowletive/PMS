import uuid

from sqlalchemy import CheckConstraint, Column, Date, DateTime, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base
from app.shared.mixins import OrganizationScopedMixin


class GanttTask(Base, OrganizationScopedMixin):
    __tablename__ = "gantt_tasks"
    __table_args__ = (CheckConstraint("end_date >= start_date", name="ck_gantt_tasks_date_range"),)

    gantt_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False, index=True)
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.task_id", ondelete="CASCADE"), nullable=False, index=True)
    dependency_task = Column(
        UUID(as_uuid=True),
        ForeignKey("gantt_tasks.gantt_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    progress = Column(Numeric(5, 2), nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    project = relationship("Project", back_populates="gantt_tasks")
    task = relationship("Task", back_populates="gantt_entries")

    # Self-reference: dependency_task points at another gantt_tasks row (critical-path analysis)
    dependency = relationship("GanttTask", back_populates="dependents", remote_side=[gantt_id])
    dependents = relationship("GanttTask", back_populates="dependency")

    def __repr__(self) -> str:
        return f"<GanttTask task_id={self.task_id} {self.start_date}..{self.end_date}>"
