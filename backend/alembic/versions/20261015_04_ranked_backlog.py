"""Persist a stable order for project backlogs.

Revision ID: 20261015_04
Revises: 20261015_03
"""

from alembic import op
import sqlalchemy as sa


revision = "20261015_04"
down_revision = "20261015_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("backlog_rank", sa.Integer(), nullable=True))
    op.execute("""
        WITH ranked AS (
            SELECT task_id, ROW_NUMBER() OVER (
                PARTITION BY project_id ORDER BY created_at ASC, task_id ASC
            ) - 1 AS position
            FROM tasks
        )
        UPDATE tasks SET backlog_rank = ranked.position
        FROM ranked WHERE tasks.task_id = ranked.task_id
    """)
    op.alter_column("tasks", "backlog_rank", nullable=False, server_default="0")
    op.create_index("ix_tasks_backlog_rank", "tasks", ["backlog_rank"])


def downgrade() -> None:
    op.drop_index("ix_tasks_backlog_rank", table_name="tasks")
    op.drop_column("tasks", "backlog_rank")
