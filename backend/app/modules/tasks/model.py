import uuid

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base
from app.shared.mixins import OrganizationScopedMixin
from app.shared.mixins import TimestampMixin


class Task(Base, OrganizationScopedMixin, TimestampMixin):
    __tablename__ = "tasks"

    task_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False, index=True)
    team_id = Column(UUID(as_uuid=True), ForeignKey("teams.team_id", ondelete="SET NULL"), nullable=True, index=True)
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
    sprint_id = Column(
        UUID(as_uuid=True),
        ForeignKey("task_sprints.sprint_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    task_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    task_type = Column(String(20), nullable=False, default="TASK")
    story_points = Column(Integer, nullable=True)
    status = Column(String(20), nullable=False, default="TODO", index=True)
    priority = Column(String(20), nullable=False, default="MEDIUM")
    due_date = Column(Date, nullable=True)
    checklist_items = Column(JSONB, nullable=False, default=list, server_default="[]")

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
    comments = relationship("TaskComment", back_populates="task", cascade="all, delete-orphan")
    activity = relationship("TaskActivity", back_populates="task", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Task {self.task_name}>"

    @property
    def assignee_name(self) -> str | None:
        return self.assignee.name if self.assignee else None


class TaskSprint(Base, OrganizationScopedMixin, TimestampMixin):
    __tablename__ = "task_sprints"

    sprint_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False, index=True)
    sprint_name = Column(String(150), nullable=False)
    goal = Column(Text, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    status = Column(String(20), nullable=False, default="PLANNED", index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True)


class TaskComment(Base, OrganizationScopedMixin):
    __tablename__ = "task_comments"

    comment_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.task_id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    task = relationship("Task", back_populates="comments")
    author = relationship("User")

    @property
    def author_name(self):
        return self.author.name if self.author else "Former member"


class TaskActivity(Base, OrganizationScopedMixin):
    __tablename__ = "task_activity"

    activity_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.task_id", ondelete="CASCADE"), nullable=False, index=True)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True)
    event_type = Column(String(40), nullable=False)
    details = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    task = relationship("Task", back_populates="activity")
    actor = relationship("User")

    @property
    def actor_name(self):
        return self.actor.name if self.actor else "Former member"


class TaskWorkSession(Base, OrganizationScopedMixin):
    """One shared timer session can cover several tasks, so elapsed time is counted once."""
    __tablename__ = "task_work_sessions"

    work_session_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    started_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    ended_at = Column(DateTime(timezone=True), nullable=True)
    duration_seconds = Column(Integer, nullable=False, default=0)
    user = relationship("User")
    task_links = relationship("TaskWorkSessionTask", back_populates="session", cascade="all, delete-orphan")


class TaskWorkSessionTask(Base, OrganizationScopedMixin):
    __tablename__ = "task_work_session_tasks"

    work_session_id = Column(UUID(as_uuid=True), ForeignKey("task_work_sessions.work_session_id", ondelete="CASCADE"), primary_key=True)
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.task_id", ondelete="CASCADE"), primary_key=True)
    linked_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    ended_at = Column(DateTime(timezone=True), nullable=True)
    duration_seconds = Column(Integer, nullable=False, default=0, server_default="0")
    session = relationship("TaskWorkSession", back_populates="task_links")
    task = relationship("Task")
