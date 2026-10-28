"""Add task reminder settings and delivery deduplication.

Revision ID: 20261021_31
Revises: 20261021_30
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20261021_31"
down_revision = "20261021_30"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("reminder_days_before", sa.Integer(), nullable=True))
    op.create_check_constraint(
        "ck_tasks_reminder_days_before",
        "tasks",
        "reminder_days_before IS NULL OR reminder_days_before IN (0, 1, 2, 7)",
    )
    op.create_table(
        "task_reminder_deliveries",
        sa.Column("delivery_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("reminder_days_before", sa.Integer(), nullable=False),
        sa.Column("delivered_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.organization_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.task_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("delivery_id"),
        sa.UniqueConstraint(
            "task_id", "user_id", "due_date", "reminder_days_before",
            name="uq_task_reminder_deliveries_schedule",
        ),
        sa.CheckConstraint("reminder_days_before IN (0, 1, 2, 7)", name="ck_task_reminder_deliveries_days"),
    )
    op.create_index("ix_task_reminder_deliveries_organization_id", "task_reminder_deliveries", ["organization_id"])
    op.create_index("ix_task_reminder_deliveries_task_id", "task_reminder_deliveries", ["task_id"])
    op.create_index("ix_task_reminder_deliveries_user_id", "task_reminder_deliveries", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_task_reminder_deliveries_user_id", table_name="task_reminder_deliveries")
    op.drop_index("ix_task_reminder_deliveries_task_id", table_name="task_reminder_deliveries")
    op.drop_index("ix_task_reminder_deliveries_organization_id", table_name="task_reminder_deliveries")
    op.drop_table("task_reminder_deliveries")
    op.drop_constraint("ck_tasks_reminder_days_before", "tasks", type_="check")
    op.drop_column("tasks", "reminder_days_before")
