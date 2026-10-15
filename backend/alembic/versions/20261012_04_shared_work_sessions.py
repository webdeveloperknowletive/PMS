"""Add one shared, persisted timer that can be linked to multiple tasks."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20261012_04"
down_revision = "20261012_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "task_work_sessions",
        sa.Column("work_session_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.organization_id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_task_work_sessions_organization_id", "task_work_sessions", ["organization_id"])
    op.create_index("ix_task_work_sessions_user_id", "task_work_sessions", ["user_id"])
    op.create_index(
        "uq_task_work_sessions_one_active_per_user", "task_work_sessions", ["organization_id", "user_id"],
        unique=True, postgresql_where=sa.text("ended_at IS NULL"),
    )
    op.create_table(
        "task_work_session_tasks",
        sa.Column("work_session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("task_work_sessions.work_session_id", ondelete="CASCADE"), primary_key=True),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tasks.task_id", ondelete="CASCADE"), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.organization_id", ondelete="CASCADE"), nullable=False),
    )
    op.create_index("ix_task_work_session_tasks_organization_id", "task_work_session_tasks", ["organization_id"])
    op.create_index("ix_task_work_session_tasks_task_id", "task_work_session_tasks", ["task_id"])


def downgrade() -> None:
    op.drop_table("task_work_session_tasks")
    op.drop_table("task_work_sessions")
