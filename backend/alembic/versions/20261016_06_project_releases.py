"""Add project releases and task version links.

Revision ID: 20261016_06
Revises: 20261015_05
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20261016_06"
down_revision = "20261015_05"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "project_releases",
        sa.Column("release_id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("version", sa.String(length=50), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="PLANNED"),
        sa.Column("release_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["project_id"], ["projects.project_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.organization_id"], ondelete="CASCADE"),
    )
    op.create_index("ix_project_releases_project_id", "project_releases", ["project_id"])
    op.create_index("ix_project_releases_organization_id", "project_releases", ["organization_id"])
    op.create_index("ix_project_releases_status", "project_releases", ["status"])
    op.add_column("tasks", sa.Column("release_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_tasks_release_id_project_releases", "tasks", "project_releases", ["release_id"], ["release_id"], ondelete="SET NULL")
    op.create_index("ix_tasks_release_id", "tasks", ["release_id"])


def downgrade() -> None:
    op.drop_index("ix_tasks_release_id", table_name="tasks")
    op.drop_constraint("fk_tasks_release_id_project_releases", "tasks", type_="foreignkey")
    op.drop_column("tasks", "release_id")
    op.drop_index("ix_project_releases_status", table_name="project_releases")
    op.drop_index("ix_project_releases_organization_id", table_name="project_releases")
    op.drop_index("ix_project_releases_project_id", table_name="project_releases")
    op.drop_table("project_releases")
