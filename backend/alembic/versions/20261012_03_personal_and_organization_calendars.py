"""Add private personal and shared organization calendars."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision = "20261012_03"
down_revision = "20261012_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    if connection.dialect.name != "postgresql":
        raise RuntimeError("SprintIX workspace migrations currently require PostgreSQL.")
    columns = {column["name"] for column in inspect(connection).get_columns("calendar_events")}
    if "calendar_scope" not in columns:
        op.add_column("calendar_events", sa.Column("calendar_scope", sa.String(20), nullable=False, server_default="ORGANIZATION"))
    if "calendar_owner_id" not in columns:
        op.add_column("calendar_events", sa.Column("calendar_owner_id", postgresql.UUID(as_uuid=True), nullable=True))
        op.create_foreign_key(
            "fk_calendar_events_calendar_owner_id_users",
            "calendar_events", "users", ["calendar_owner_id"], ["user_id"], ondelete="CASCADE",
        )
    if "related_task_id" not in columns:
        op.add_column("calendar_events", sa.Column("related_task_id", postgresql.UUID(as_uuid=True), nullable=True))
        op.create_foreign_key(
            "fk_calendar_events_related_task_id_tasks",
            "calendar_events", "tasks", ["related_task_id"], ["task_id"], ondelete="CASCADE",
        )
    if "is_automatic" not in columns:
        op.add_column("calendar_events", sa.Column("is_automatic", sa.Boolean(), nullable=False, server_default=sa.false()))
    constraints = {constraint.get("name") for constraint in inspect(connection).get_check_constraints("calendar_events")}
    if "ck_calendar_events_scope_owner" not in constraints:
        op.create_check_constraint(
            "ck_calendar_events_scope_owner",
            "calendar_events",
            "(calendar_scope = 'ORGANIZATION' AND calendar_owner_id IS NULL) OR "
            "(calendar_scope = 'PERSONAL' AND calendar_owner_id IS NOT NULL)",
        )
    connection.exec_driver_sql('CREATE INDEX IF NOT EXISTS "ix_calendar_events_calendar_scope" ON "calendar_events" ("calendar_scope")')
    connection.exec_driver_sql('CREATE INDEX IF NOT EXISTS "ix_calendar_events_calendar_owner_id" ON "calendar_events" ("calendar_owner_id")')
    connection.exec_driver_sql('CREATE INDEX IF NOT EXISTS "ix_calendar_events_related_task_id" ON "calendar_events" ("related_task_id")')


def downgrade() -> None:
    raise RuntimeError("Restore a verified database backup to reverse this data-preserving migration.")
