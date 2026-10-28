"""Add recoverable archive metadata to tasks.

Revision ID: 20261021_27
Revises: 20261021_26
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20261021_27"
down_revision = "20261021_26"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("tasks", sa.Column("archived_by_user_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index("ix_tasks_archived_at", "tasks", ["archived_at"])
    op.create_foreign_key(
        "fk_tasks_archived_by_user_id_users",
        "tasks", "users", ["archived_by_user_id"], ["user_id"], ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_tasks_archived_by_user_id_users", "tasks", type_="foreignkey")
    op.drop_index("ix_tasks_archived_at", table_name="tasks")
    op.drop_column("tasks", "archived_by_user_id")
    op.drop_column("tasks", "archived_at")
