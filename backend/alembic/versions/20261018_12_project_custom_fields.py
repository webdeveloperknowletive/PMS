"""Add project-defined task custom fields.

Revision ID: 20261018_12
Revises: 20261018_11
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20261018_12"
down_revision = "20261018_11"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "project_custom_fields",
        sa.Column("field_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("field_type", sa.String(length=20), nullable=False),
        sa.Column("is_required", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("options", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("default_value", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("field_type IN ('TEXT', 'NUMBER', 'DATE', 'SINGLE_SELECT', 'CHECKBOX')", name="ck_project_custom_fields_field_type"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.organization_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.project_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("field_id"),
        sa.UniqueConstraint("project_id", "name", name="uq_project_custom_fields_project_name"),
    )
    op.create_index("ix_project_custom_fields_organization_id", "project_custom_fields", ["organization_id"])
    op.create_index("ix_project_custom_fields_project_id", "project_custom_fields", ["project_id"])
    op.add_column("tasks", sa.Column("custom_fields", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=False))
    op.alter_column("tasks", "custom_fields", server_default=None)


def downgrade() -> None:
    op.drop_column("tasks", "custom_fields")
    op.drop_index("ix_project_custom_fields_project_id", table_name="project_custom_fields")
    op.drop_index("ix_project_custom_fields_organization_id", table_name="project_custom_fields")
    op.drop_table("project_custom_fields")
