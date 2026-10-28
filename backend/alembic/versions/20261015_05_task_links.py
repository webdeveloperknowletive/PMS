"""Add typed links between work items.

Revision ID: 20261015_05
Revises: 20261015_04
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20261015_05"
down_revision = "20261015_04"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "task_links",
        sa.Column("link_id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_task_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("target_task_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("link_type", sa.String(length=20), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.organization_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_task_id"], ["tasks.task_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_task_id"], ["tasks.task_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.user_id"], ondelete="SET NULL"),
        sa.UniqueConstraint("source_task_id", "target_task_id", "link_type", name="uq_task_links_edge"),
        sa.CheckConstraint("source_task_id <> target_task_id", name="ck_task_links_no_self_link"),
        sa.CheckConstraint("link_type IN ('BLOCKS', 'RELATES_TO', 'DUPLICATES')", name="ck_task_links_type"),
    )
    op.create_index("ix_task_links_organization_id", "task_links", ["organization_id"])
    op.create_index("ix_task_links_source_task_id", "task_links", ["source_task_id"])
    op.create_index("ix_task_links_target_task_id", "task_links", ["target_task_id"])


def downgrade() -> None:
    op.drop_index("ix_task_links_target_task_id", table_name="task_links")
    op.drop_index("ix_task_links_source_task_id", table_name="task_links")
    op.drop_index("ix_task_links_organization_id", table_name="task_links")
    op.drop_table("task_links")
