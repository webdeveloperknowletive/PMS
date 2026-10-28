"""Add sprint capacity and scope history.

Revision ID: 20261018_15
Revises: 20261018_14
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20261018_15"
down_revision = "20261018_14"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("task_sprints", sa.Column("capacity_points", sa.Integer(), nullable=True))
    op.create_check_constraint(
        "ck_task_sprints_capacity_points", "task_sprints",
        "capacity_points IS NULL OR capacity_points BETWEEN 0 AND 10000",
    )
    op.create_table(
        "task_sprint_scope_changes",
        sa.Column("scope_change_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sprint_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("task_name", sa.String(length=255), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("event_type", sa.String(length=20), nullable=False),
        sa.Column("points_before", sa.Integer(), nullable=True),
        sa.Column("points_after", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("event_type IN ('BASELINE', 'ADDED', 'REMOVED', 'POINTS_CHANGED')", name="ck_task_sprint_scope_changes_type"),
        sa.CheckConstraint("points_before IS NULL OR points_before >= 0", name="ck_task_sprint_scope_changes_points_before"),
        sa.CheckConstraint("points_after IS NULL OR points_after >= 0", name="ck_task_sprint_scope_changes_points_after"),
        sa.ForeignKeyConstraint(["actor_id"], ["users.user_id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.organization_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["sprint_id"], ["task_sprints.sprint_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.task_id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("scope_change_id"),
    )
    op.create_index("ix_task_sprint_scope_changes_organization_id", "task_sprint_scope_changes", ["organization_id"])
    op.create_index("ix_task_sprint_scope_changes_sprint_id", "task_sprint_scope_changes", ["sprint_id"])
    op.create_index("ix_task_sprint_scope_changes_task_id", "task_sprint_scope_changes", ["task_id"])
    op.create_index("ix_task_sprint_scope_changes_created_at", "task_sprint_scope_changes", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_task_sprint_scope_changes_created_at", table_name="task_sprint_scope_changes")
    op.drop_index("ix_task_sprint_scope_changes_task_id", table_name="task_sprint_scope_changes")
    op.drop_index("ix_task_sprint_scope_changes_sprint_id", table_name="task_sprint_scope_changes")
    op.drop_index("ix_task_sprint_scope_changes_organization_id", table_name="task_sprint_scope_changes")
    op.drop_table("task_sprint_scope_changes")
    op.drop_constraint("ck_task_sprints_capacity_points", "task_sprints", type_="check")
    op.drop_column("task_sprints", "capacity_points")
