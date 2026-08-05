import uuid

from sqlalchemy import Column, Date, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.shared.mixins import TimestampMixin


class Task(Base, TimestampMixin):
    __tablename__ = "tasks"

    task_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True, index=True)
    sprint_plan_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ai_sprint_plans.sprint_plan_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    parent_task_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tasks.task_id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    task_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="TODO", index=True)
    priority = Column(String(20), nullable=False, default="MEDIUM")
    due_date = Column(Date, nullable=True)

    # --- Relationships ---
    project = relationship("Project", back_populates="tasks")
    assignee = relationship("User", back_populates="tasks")
    sprint_plan = relationship("AISprintPlan", back_populates="tasks")

    # Self-referencing subtasks
    parent_task = relationship("Task", back_populates="subtasks", remote_side=[task_id])
    subtasks = relationship("Task", back_populates="parent_task", cascade="all, delete-orphan")

    risk_predictions = relationship("AIRiskPrediction", back_populates="task")
    estimations = relationship("AITaskEstimation", back_populates="task", cascade="all, delete-orphan")
    kanban_entry = relationship("KanbanTask", back_populates="task", uselist=False, cascade="all, delete-orphan")
    gantt_entries = relationship("GanttTask", back_populates="task", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Task {self.task_name}>"
