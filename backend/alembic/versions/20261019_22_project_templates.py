"""Add reusable project starter board templates.

Revision ID: 20261019_22
Revises: 20261019_21
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20261019_22"
down_revision = "20261019_21"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "project_templates",
        sa.Column("template_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("board_template", sa.String(length=20), nullable=False, server_default="STANDARD"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("board_template IN ('STANDARD', 'SIMPLE', 'BLOCKED')", name="ck_project_templates_board_template"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.organization_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.user_id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("template_id"),
        sa.UniqueConstraint("organization_id", "name", name="uq_project_templates_organization_name"),
    )
    op.create_index("ix_project_templates_organization_id", "project_templates", ["organization_id"])


def downgrade() -> None:
    op.drop_index("ix_project_templates_organization_id", table_name="project_templates")
    op.drop_table("project_templates")
