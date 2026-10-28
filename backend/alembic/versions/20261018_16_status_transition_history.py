"""Add append-only structured task status history.

Revision ID: 20261018_16
Revises: 20261018_15
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20261018_16"
down_revision = "20261018_15"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "task_status_history",
        sa.Column("history_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("task_name", sa.String(length=255), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("from_status", sa.String(length=20), nullable=True),
        sa.Column("to_status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("from_status IS NULL OR from_status IN ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED', 'CANCELLED')", name="ck_task_status_history_from_status"),
        sa.CheckConstraint("to_status IN ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED', 'CANCELLED')", name="ck_task_status_history_to_status"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.organization_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("history_id"),
    )
    op.create_index("ix_task_status_history_organization_id", "task_status_history", ["organization_id"])
    op.create_index("ix_task_status_history_task_id", "task_status_history", ["task_id"])
    op.create_index("ix_task_status_history_created_at", "task_status_history", ["created_at"])
    op.execute("""
        CREATE FUNCTION prevent_task_status_history_mutation() RETURNS trigger AS $$
        BEGIN
            IF pg_trigger_depth() = 1 THEN
                RAISE EXCEPTION 'task status history is append-only';
            END IF;
            RETURN OLD;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_task_status_history_immutable
        BEFORE UPDATE OR DELETE ON task_status_history
        FOR EACH ROW EXECUTE FUNCTION prevent_task_status_history_mutation();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER trg_task_status_history_immutable ON task_status_history")
    op.execute("DROP FUNCTION prevent_task_status_history_mutation()")
    op.drop_index("ix_task_status_history_created_at", table_name="task_status_history")
    op.drop_index("ix_task_status_history_task_id", table_name="task_status_history")
    op.drop_index("ix_task_status_history_organization_id", table_name="task_status_history")
    op.drop_table("task_status_history")
