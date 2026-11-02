"""Additive fields for linked calendar items and reviewed AI applications.

Revision ID: 20261031_33
Revises: 20261030_32
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20261031_33"
down_revision = "20261030_32"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("calendar_events", sa.Column("related_milestone_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_calendar_events_related_milestone", "calendar_events", "milestones",
        ["related_milestone_id"], ["milestone_id"], ondelete="CASCADE",
    )
    op.create_index("ix_calendar_events_related_milestone_id", "calendar_events", ["related_milestone_id"])

    op.add_column("tasks", sa.Column("estimated_hours", sa.Numeric(8, 2), nullable=True))
    op.add_column("ai_task_estimations", sa.Column("is_applied", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("ai_task_estimations", sa.Column("applied_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("ai_sprint_plans", sa.Column("applied_sprint_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_ai_sprint_plans_applied_sprint", "ai_sprint_plans", "task_sprints",
        ["applied_sprint_id"], ["sprint_id"], ondelete="SET NULL",
    )
    op.add_column(
        "ai_meeting_summaries",
        sa.Column("applied_action_items", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
    )
    op.add_column("ai_document_generations", sa.Column("published_document_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_ai_document_generations_published_document", "ai_document_generations", "documents",
        ["published_document_id"], ["document_id"], ondelete="SET NULL",
    )
    op.add_column("documents", sa.Column("content", sa.Text(), nullable=True))
    op.add_column(
        "notification_user_settings",
        sa.Column("email_task_deadline_reminders", sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade() -> None:
    op.drop_column("notification_user_settings", "email_task_deadline_reminders")
    op.drop_column("documents", "content")
    op.drop_constraint("fk_ai_document_generations_published_document", "ai_document_generations", type_="foreignkey")
    op.drop_column("ai_document_generations", "published_document_id")
    op.drop_column("ai_meeting_summaries", "applied_action_items")
    op.drop_constraint("fk_ai_sprint_plans_applied_sprint", "ai_sprint_plans", type_="foreignkey")
    op.drop_column("ai_sprint_plans", "applied_sprint_id")
    op.drop_column("ai_task_estimations", "applied_at")
    op.drop_column("ai_task_estimations", "is_applied")
    op.drop_column("tasks", "estimated_hours")
    op.drop_index("ix_calendar_events_related_milestone_id", table_name="calendar_events")
    op.drop_constraint("fk_calendar_events_related_milestone", "calendar_events", type_="foreignkey")
    op.drop_column("calendar_events", "related_milestone_id")
