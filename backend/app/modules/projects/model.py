import uuid

from sqlalchemy import Boolean, CheckConstraint, Column, Date, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.shared.mixins import OrganizationScopedMixin
from app.shared.mixins import TimestampMixin
from sqlalchemy.sql import func


class Project(Base, OrganizationScopedMixin, TimestampMixin):
    __tablename__ = "projects"
    __table_args__ = (UniqueConstraint("organization_id", "project_key", name="uq_projects_organization_project_key"),)

    project_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_name = Column(String(200), nullable=False)
    project_key = Column(String(12), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="ACTIVE", index=True)
    priority = Column(String(20), nullable=False, default="MEDIUM")
    start_date = Column(Date, nullable=True)
    due_date = Column(Date, nullable=True)
    project_manager_user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True, index=True)

    # --- Relationships ---
    teams = relationship("Team", back_populates="project", cascade="all, delete-orphan")
    project_manager = relationship("User", foreign_keys=[project_manager_user_id])
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    milestones = relationship("Milestone", back_populates="project", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="project", cascade="all, delete-orphan")
    workflows = relationship("Workflow", back_populates="project", cascade="all, delete-orphan")
    sprint_plans = relationship("AISprintPlan", back_populates="project", cascade="all, delete-orphan")
    risk_predictions = relationship("AIRiskPrediction", back_populates="project", cascade="all, delete-orphan")
    document_generations = relationship("AIDocumentGeneration", back_populates="project", cascade="all, delete-orphan")
    task_estimations = relationship("AITaskEstimation", back_populates="project", cascade="all, delete-orphan")
    meeting_summaries = relationship("AIMeetingSummary", back_populates="project", cascade="all, delete-orphan")
    kanban_columns = relationship("KanbanColumn", back_populates="project", cascade="all, delete-orphan")
    gantt_tasks = relationship("GanttTask", back_populates="project", cascade="all, delete-orphan")
    calendar_events = relationship("CalendarEvent", back_populates="project", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="project", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="project", cascade="all, delete-orphan")
    goals = relationship("ProjectGoal", back_populates="project", cascade="all, delete-orphan")
    releases = relationship("ProjectRelease", back_populates="project", cascade="all, delete-orphan")
    components = relationship("ProjectComponent", back_populates="project", cascade="all, delete-orphan")
    custom_fields = relationship("ProjectCustomField", back_populates="project", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Project {self.project_name}>"


class ProjectGoal(Base, OrganizationScopedMixin, TimestampMixin):
    __tablename__ = "project_goals"

    goal_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    success_measure = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="ACTIVE", index=True)
    target_date = Column(Date, nullable=True)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True, index=True)
    parent_goal_id = Column(UUID(as_uuid=True), ForeignKey("project_goals.goal_id", ondelete="SET NULL"), nullable=True, index=True)

    project = relationship("Project", back_populates="goals")
    tasks = relationship("Task", back_populates="goal")


class ProjectRelease(Base, OrganizationScopedMixin, TimestampMixin):
    __tablename__ = "project_releases"

    release_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    version = Column(String(50), nullable=True)
    status = Column(String(20), nullable=False, default="PLANNED", index=True)
    release_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)

    project = relationship("Project", back_populates="releases")
    tasks = relationship("Task", back_populates="release")


class ProjectReleaseScopeChange(Base, OrganizationScopedMixin):
    __tablename__ = "project_release_scope_changes"
    __table_args__ = (
        CheckConstraint("event_type IN ('BASELINE', 'ADDED', 'REMOVED')", name="ck_project_release_scope_changes_type"),
    )

    scope_change_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False, index=True)
    # Keep the identifier and release name as a snapshot so deleting a release
    # does not erase its scope history.
    release_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    release_name = Column(String(150), nullable=False)
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.task_id", ondelete="SET NULL"), nullable=True, index=True)
    task_name = Column(String(255), nullable=False)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True)
    event_type = Column(String(20), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)


class ProjectTemplate(Base, OrganizationScopedMixin, TimestampMixin):
    __tablename__ = "project_templates"
    __table_args__ = (
        CheckConstraint("board_template IN ('STANDARD', 'SIMPLE', 'BLOCKED')", name="ck_project_templates_board_template"),
        UniqueConstraint("organization_id", "name", name="uq_project_templates_organization_name"),
    )

    template_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    board_template = Column(String(20), nullable=False, default="STANDARD")
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True)

    creator = relationship("User", foreign_keys=[created_by])


class ProjectComponent(Base, OrganizationScopedMixin, TimestampMixin):
    __tablename__ = "project_components"
    __table_args__ = (UniqueConstraint("project_id", "name", name="uq_project_components_project_name"),)

    component_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)

    project = relationship("Project", back_populates="components")
    tasks = relationship("Task", back_populates="component")


class ProjectCustomField(Base, OrganizationScopedMixin, TimestampMixin):
    __tablename__ = "project_custom_fields"
    __table_args__ = (
        UniqueConstraint("project_id", "name", name="uq_project_custom_fields_project_name"),
        CheckConstraint("field_type IN ('TEXT', 'NUMBER', 'DATE', 'SINGLE_SELECT', 'CHECKBOX')", name="ck_project_custom_fields_field_type"),
    )

    field_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.project_id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    field_type = Column(String(20), nullable=False)
    is_required = Column(Boolean, nullable=False, default=False, server_default="false")
    options = Column(JSONB, nullable=False, default=list, server_default="[]")
    default_value = Column(JSONB, nullable=True)

    project = relationship("Project", back_populates="custom_fields")
