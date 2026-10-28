"""Add project components and optional task assignments to them.

Revision ID: 20261018_10
Revises: 20261016_09
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20261018_10"
down_revision = "20261016_09"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "project_components",
        sa.Column("component_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.organization_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.project_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("component_id"),
        sa.UniqueConstraint("project_id", "name", name="uq_project_components_project_name"),
    )
    op.create_index("ix_project_components_organization_id", "project_components", ["organization_id"])
    op.create_index("ix_project_components_project_id", "project_components", ["project_id"])
    op.add_column("tasks", sa.Column("component_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_tasks_component_id_project_components", "tasks", "project_components",
        ["component_id"], ["component_id"], ondelete="SET NULL",
    )
    op.create_index("ix_tasks_component_id", "tasks", ["component_id"])


def downgrade() -> None:
    op.drop_index("ix_tasks_component_id", table_name="tasks")
    op.drop_constraint("fk_tasks_component_id_project_components", "tasks", type_="foreignkey")
    op.drop_column("tasks", "component_id")
    op.drop_index("ix_project_components_project_id", table_name="project_components")
    op.drop_index("ix_project_components_organization_id", table_name="project_components")
    op.drop_table("project_components")
