"""Add project goals and task links.

Revision ID: 20261015_03
Revises: 20261015_02
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20261015_03"
down_revision = "20261015_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "project_goals",
        sa.Column("goal_id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="ACTIVE"),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["project_id"], ["projects.project_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.organization_id"], ondelete="CASCADE"),
    )
    op.create_index("ix_project_goals_project_id", "project_goals", ["project_id"])
    op.create_index("ix_project_goals_organization_id", "project_goals", ["organization_id"])
    op.create_index("ix_project_goals_status", "project_goals", ["status"])
    op.add_column("tasks", sa.Column("goal_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_tasks_goal_id_project_goals", "tasks", "project_goals", ["goal_id"], ["goal_id"], ondelete="SET NULL")
    op.create_index("ix_tasks_goal_id", "tasks", ["goal_id"])


def downgrade() -> None:
    op.drop_index("ix_tasks_goal_id", table_name="tasks")
    op.drop_constraint("fk_tasks_goal_id_project_goals", "tasks", type_="foreignkey")
    op.drop_column("tasks", "goal_id")
    op.drop_index("ix_project_goals_status", table_name="project_goals")
    op.drop_index("ix_project_goals_organization_id", table_name="project_goals")
    op.drop_index("ix_project_goals_project_id", table_name="project_goals")
    op.drop_table("project_goals")
