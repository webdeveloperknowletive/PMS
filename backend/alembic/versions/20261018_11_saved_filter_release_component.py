"""Preserve component and release filters in saved task views.

Revision ID: 20261018_11
Revises: 20261018_10
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20261018_11"
down_revision = "20261018_10"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("saved_task_filters", sa.Column("component_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("saved_task_filters", sa.Column("release_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_saved_task_filters_component_id_project_components",
        "saved_task_filters", "project_components", ["component_id"], ["component_id"], ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_saved_task_filters_release_id_project_releases",
        "saved_task_filters", "project_releases", ["release_id"], ["release_id"], ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_saved_task_filters_release_id_project_releases", "saved_task_filters", type_="foreignkey")
    op.drop_constraint("fk_saved_task_filters_component_id_project_components", "saved_task_filters", type_="foreignkey")
    op.drop_column("saved_task_filters", "release_id")
    op.drop_column("saved_task_filters", "component_id")
