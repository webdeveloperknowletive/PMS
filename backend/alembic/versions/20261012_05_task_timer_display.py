"""Persist each task's portion of a shared timer for the Kanban clock."""

from alembic import op
import sqlalchemy as sa

revision = "20261012_05"
down_revision = "20261012_04"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("task_work_session_tasks", sa.Column("linked_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("task_work_session_tasks", sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("task_work_session_tasks", sa.Column("duration_seconds", sa.Integer(), nullable=False, server_default="0"))
    op.execute(
        "UPDATE task_work_session_tasks AS task_link "
        "SET linked_at = work_session.started_at, "
        "ended_at = work_session.ended_at, "
        "duration_seconds = CASE WHEN work_session.ended_at IS NULL THEN 0 ELSE work_session.duration_seconds END "
        "FROM task_work_sessions AS work_session "
        "WHERE task_link.work_session_id = work_session.work_session_id AND task_link.linked_at IS NULL"
    )
    op.alter_column("task_work_session_tasks", "linked_at", nullable=False, server_default=sa.func.now())


def downgrade() -> None:
    op.drop_column("task_work_session_tasks", "duration_seconds")
    op.drop_column("task_work_session_tasks", "ended_at")
    op.drop_column("task_work_session_tasks", "linked_at")
