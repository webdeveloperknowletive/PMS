"""Store personal task filter presets per workspace.

Revision ID: 20261015_02
Revises: 20261015_01
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20261015_02"
down_revision = "20261015_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "saved_task_filters",
        sa.Column("filter_id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("search", sa.String(length=120), nullable=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("assignee_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("task_status", sa.String(length=20), nullable=True),
        sa.Column("priority", sa.String(length=20), nullable=True),
        sa.Column("overdue", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.organization_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
        sa.UniqueConstraint("organization_id", "user_id", "name", name="uq_saved_task_filters_owner_name"),
    )
    op.create_index("ix_saved_task_filters_organization_id", "saved_task_filters", ["organization_id"])
    op.create_index("ix_saved_task_filters_user_id", "saved_task_filters", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_saved_task_filters_user_id", table_name="saved_task_filters")
    op.drop_index("ix_saved_task_filters_organization_id", table_name="saved_task_filters")
    op.drop_table("saved_task_filters")
