"""Add goal ownership, success measures, and same-project hierarchy.

Revision ID: 20261018_14
Revises: 20261018_13
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20261018_14"
down_revision = "20261018_13"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("project_goals", sa.Column("success_measure", sa.Text(), nullable=True))
    op.add_column("project_goals", sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("project_goals", sa.Column("parent_goal_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_project_goals_owner_id_users", "project_goals", "users", ["owner_id"], ["user_id"], ondelete="SET NULL")
    op.create_foreign_key("fk_project_goals_parent_goal_id_project_goals", "project_goals", "project_goals", ["parent_goal_id"], ["goal_id"], ondelete="SET NULL")
    op.create_index("ix_project_goals_owner_id", "project_goals", ["owner_id"])
    op.create_index("ix_project_goals_parent_goal_id", "project_goals", ["parent_goal_id"])


def downgrade() -> None:
    op.drop_index("ix_project_goals_parent_goal_id", table_name="project_goals")
    op.drop_index("ix_project_goals_owner_id", table_name="project_goals")
    op.drop_constraint("fk_project_goals_parent_goal_id_project_goals", "project_goals", type_="foreignkey")
    op.drop_constraint("fk_project_goals_owner_id_users", "project_goals", type_="foreignkey")
    op.drop_column("project_goals", "parent_goal_id")
    op.drop_column("project_goals", "owner_id")
    op.drop_column("project_goals", "success_measure")
