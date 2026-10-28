import uuid

from sqlalchemy import Boolean, CheckConstraint, Column, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base
from app.shared.mixins import OrganizationScopedMixin
from app.shared.mixins import TimestampMixin


class Task(Base, OrganizationScopedMixin, TimestampMixin):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint(
            "reminder_days_before IS NULL OR reminder_days_before IN (0, 1, 2, 7)",
            name="ck_tasks_reminder_days_before",
        ),
    )

    task_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False, index=True)
    goal_id = Column(UUID(as_uuid=True), ForeignKey("project_goals.goal_id", ondelete="SET NULL"), nullable=True, index=True)
    release_id = Column(UUID(as_uuid=True), ForeignKey("project_releases.release_id", ondelete="SET NULL"), nullable=True, index=True)
    component_id = Column(UUID(as_uuid=True), ForeignKey("project_components.component_id", ondelete="SET NULL"), nullable=True, index=True)
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
    backlog_rank = Column(Integer, nullable=False, default=0, server_default="0", index=True)
    start_date = Column(Date, nullable=True)
    due_date = Column(Date, nullable=True)
    reminder_days_before = Column(Integer, nullable=True)
    checklist_items = Column(JSONB, nullable=False, default=list, server_default="[]")
    labels = Column(JSONB, nullable=False, default=list, server_default="[]")
    custom_fields = Column(JSONB, nullable=False, default=dict, server_default="{}")
    archived_at = Column(DateTime(timezone=True), nullable=True, index=True)
    archived_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True)

    # --- Relationships ---
    project = relationship("Project", back_populates="tasks")
    goal = relationship("ProjectGoal", back_populates="tasks")
    release = relationship("ProjectRelease", back_populates="tasks")
    component = relationship("ProjectComponent", back_populates="tasks")
    assignee = relationship("User", back_populates="tasks", foreign_keys=[user_id])
    sprint_plan = relationship("AISprintPlan", back_populates="tasks")

    # Self-referencing subtasks
    parent_task = relationship("Task", back_populates="subtasks", remote_side=[task_id])
    subtasks = relationship("Task", back_populates="parent_task", cascade="all, delete-orphan")

    risk_predictions = relationship("AIRiskPrediction", back_populates="task")
    estimations = relationship("AITaskEstimation", back_populates="task", cascade="all, delete-orphan")
    kanban_entry = relationship("KanbanTask", back_populates="task", uselist=False, cascade="all, delete-orphan")
    kanban_member_assignments = relationship(
        "KanbanCardMember", back_populates="task", cascade="all, delete-orphan",
        lazy="selectin", order_by="KanbanCardMember.assigned_at",
    )
    gantt_entries = relationship("GanttTask", back_populates="task", cascade="all, delete-orphan")
    comments = relationship("TaskComment", back_populates="task", cascade="all, delete-orphan")
    activity = relationship("TaskActivity", back_populates="task", cascade="all, delete-orphan")
    attachments = relationship("TaskAttachment", back_populates="task", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Task {self.task_name}>"

    @property
    def assignee_name(self) -> str | None:
        return self.assignee.name if self.assignee else None

    @property
    def card_members(self) -> list[dict]:
        """Include the existing primary assignee and any additional card members once each."""
        members: dict[uuid.UUID, dict] = {}
        if self.assignee is not None:
            members[self.assignee.user_id] = {
                "user_id": self.assignee.user_id,
                "name": self.assignee.name,
                "profile_picture_url": self.assignee.profile_picture_url,
                "is_primary": True,
                "assigned_at": None,
            }
        for assignment in self.kanban_member_assignments:
            member = assignment.user
            if member is None or member.user_id in members:
                continue
            members[member.user_id] = {
                "user_id": member.user_id,
                "name": member.name,
                "profile_picture_url": member.profile_picture_url,
                "is_primary": False,
                "assigned_at": assignment.assigned_at,
            }
        return sorted(members.values(), key=lambda item: (not item["is_primary"], item["name"].casefold()))


class TaskReminderDelivery(Base, OrganizationScopedMixin):
    """Idempotency record for in-app task deadline reminders delivered to a user."""

    __tablename__ = "task_reminder_deliveries"
    __table_args__ = (
        UniqueConstraint(
            "task_id", "user_id", "due_date", "reminder_days_before",
            name="uq_task_reminder_deliveries_schedule",
        ),
        CheckConstraint("reminder_days_before IN (0, 1, 2, 7)", name="ck_task_reminder_deliveries_days"),
    )

    delivery_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.task_id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    due_date = Column(Date, nullable=False)
    reminder_days_before = Column(Integer, nullable=False)
    delivered_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class TaskAttachment(Base, OrganizationScopedMixin):
    __tablename__ = "task_attachments"

    attachment_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.task_id", ondelete="CASCADE"), nullable=False, index=True)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True)
    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(64), nullable=False, unique=True)
    mime_type = Column(String(255), nullable=False, default="application/octet-stream")
    file_size = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    task = relationship("Task", back_populates="attachments")
    uploader = relationship("User")


class TaskSprint(Base, OrganizationScopedMixin, TimestampMixin):
    __tablename__ = "task_sprints"
    __table_args__ = (CheckConstraint("capacity_points IS NULL OR capacity_points BETWEEN 0 AND 10000", name="ck_task_sprints_capacity_points"),)

    sprint_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False, index=True)
    sprint_name = Column(String(150), nullable=False)
    goal = Column(Text, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    capacity_points = Column(Integer, nullable=True)
    status = Column(String(20), nullable=False, default="PLANNED", index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True)


class TaskSprintScopeChange(Base, OrganizationScopedMixin):
    __tablename__ = "task_sprint_scope_changes"
    __table_args__ = (
        CheckConstraint("event_type IN ('BASELINE', 'ADDED', 'REMOVED', 'POINTS_CHANGED')", name="ck_task_sprint_scope_changes_type"),
        CheckConstraint("points_before IS NULL OR points_before >= 0", name="ck_task_sprint_scope_changes_points_before"),
        CheckConstraint("points_after IS NULL OR points_after >= 0", name="ck_task_sprint_scope_changes_points_after"),
    )

    scope_change_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sprint_id = Column(UUID(as_uuid=True), ForeignKey("task_sprints.sprint_id", ondelete="CASCADE"), nullable=False, index=True)
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.task_id", ondelete="SET NULL"), nullable=True, index=True)
    task_name = Column(String(255), nullable=False)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True)
    event_type = Column(String(20), nullable=False)
    points_before = Column(Integer, nullable=True)
    points_after = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)


class TaskStatusHistory(Base, OrganizationScopedMixin):
    __tablename__ = "task_status_history"
    __table_args__ = (
        CheckConstraint("from_status IS NULL OR from_status IN ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED', 'CANCELLED')", name="ck_task_status_history_from_status"),
        CheckConstraint("to_status IN ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED', 'CANCELLED')", name="ck_task_status_history_to_status"),
    )

    history_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    task_name = Column(String(255), nullable=False)
    actor_id = Column(UUID(as_uuid=True), nullable=True)
    from_status = Column(String(20), nullable=True)
    to_status = Column(String(20), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)


class SavedTaskFilter(Base, OrganizationScopedMixin, TimestampMixin):
    __tablename__ = "saved_task_filters"
    __table_args__ = (UniqueConstraint("organization_id", "user_id", "name", name="uq_saved_task_filters_owner_name"),)

    filter_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(60), nullable=False)
    search = Column(String(120), nullable=True)
    project_id = Column(UUID(as_uuid=True), nullable=True)
    assignee_id = Column(UUID(as_uuid=True), nullable=True)
    label = Column(String(40), nullable=True)
    component_id = Column(UUID(as_uuid=True), ForeignKey("project_components.component_id", ondelete="SET NULL"), nullable=True)
    release_id = Column(UUID(as_uuid=True), ForeignKey("project_releases.release_id", ondelete="SET NULL"), nullable=True)
    task_status = Column(String(20), nullable=True)
    priority = Column(String(20), nullable=True)
    overdue = Column(Boolean, nullable=False, default=False, server_default="false")
    is_shared = Column(Boolean, nullable=False, default=False, server_default="false")


class TaskLink(Base, OrganizationScopedMixin):
    __tablename__ = "task_links"
    __table_args__ = (
        UniqueConstraint("source_task_id", "target_task_id", "link_type", name="uq_task_links_edge"),
        CheckConstraint("source_task_id <> target_task_id", name="ck_task_links_no_self_link"),
        CheckConstraint("link_type IN ('BLOCKS', 'RELATES_TO', 'DUPLICATES')", name="ck_task_links_type"),
    )

    link_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.task_id", ondelete="CASCADE"), nullable=False, index=True)
    target_task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.task_id", ondelete="CASCADE"), nullable=False, index=True)
    link_type = Column(String(20), nullable=False)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


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
    pending_review = Column(Boolean, nullable=False, default=False, server_default="false")
    session = relationship("TaskWorkSession", back_populates="task_links")
    task = relationship("Task")
