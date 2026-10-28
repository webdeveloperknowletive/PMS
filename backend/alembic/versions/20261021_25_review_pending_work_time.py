"""Keep time logged during review pending until PM approval.

Revision ID: 20261021_25
Revises: 20261019_24
"""

from alembic import op
import sqlalchemy as sa


revision = "20261021_25"
down_revision = "20261019_24"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "task_work_session_tasks",
        sa.Column("pending_review", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("task_work_session_tasks", "pending_review")
