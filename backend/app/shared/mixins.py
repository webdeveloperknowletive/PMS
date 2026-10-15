"""
Shared SQLAlchemy model mixins.

Consolidated from usage across the codebase:

- CreatedAtMixin  -> used by: ai/risk_prediction, ai/doc_generator, ai/meeting_summary,
                     ai/task_estimation, teams.TeamLead, milestones, roles, documentation
- TimestampMixin  -> used by: ai/sprint_planning, teams.Team, projects, users, tasks, workflow

Column style matches the inline `created_at` columns already defined directly on
GanttTask, KanbanColumn, CalendarEvent (DateTime(timezone=True), server_default=func.now()),
so behavior is consistent whether a model uses the mixin or defines the column itself.
"""

from sqlalchemy import Column, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func


class CreatedAtMixin:
    """Adds a single immutable creation timestamp."""

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class TimestampMixin:
    """Adds a creation timestamp plus an auto-updating modification timestamp."""

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class OrganizationScopedMixin:
    """Marks a database record as belonging to exactly one customer workspace."""

    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.organization_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
