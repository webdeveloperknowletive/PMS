"""Store files attached to Kanban task cards.

Revision ID: 20261021_26
Revises: 20261021_25
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20261021_26"
down_revision = "20261021_25"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "task_attachments",
        sa.Column("attachment_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("uploaded_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("stored_filename", sa.String(length=64), nullable=False),
        sa.Column("mime_type", sa.String(length=255), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.organization_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.task_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.user_id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("attachment_id"),
        sa.UniqueConstraint("stored_filename", name="uq_task_attachments_stored_filename"),
    )
    op.create_index("ix_task_attachments_organization_id", "task_attachments", ["organization_id"])
    op.create_index("ix_task_attachments_task_id", "task_attachments", ["task_id"])


def downgrade() -> None:
    op.drop_index("ix_task_attachments_task_id", table_name="task_attachments")
    op.drop_index("ix_task_attachments_organization_id", table_name="task_attachments")
    op.drop_table("task_attachments")
