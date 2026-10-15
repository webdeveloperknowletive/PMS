"""Add Jira-style work types, project sprints, comments and task activity.

Revision ID: 20261012_01
Revises: 20261010_02
Create Date: 2026-10-12
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision = "20261012_01"
down_revision = "20261010_02"
branch_labels = None
depends_on = None


def _add_column_if_missing(table: str, name: str, column) -> None:
    if name not in {item["name"] for item in inspect(op.get_bind()).get_columns(table)}:
        op.add_column(table, column)


def upgrade() -> None:
    connection = op.get_bind()
    if connection.dialect.name != "postgresql":
        raise RuntimeError("SprintIX workspace migrations currently require PostgreSQL.")

    tables = set(inspect(connection).get_table_names())
    if "task_sprints" not in tables:
        op.create_table(
            "task_sprints",
            sa.Column("sprint_id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("sprint_name", sa.String(150), nullable=False),
            sa.Column("goal", sa.Text(), nullable=True),
            sa.Column("start_date", sa.Date(), nullable=True),
            sa.Column("end_date", sa.Date(), nullable=True),
            sa.Column("status", sa.String(20), nullable=False, server_default="PLANNED"),
            sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.ForeignKeyConstraint(["organization_id"], ["organizations.organization_id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["project_id"], ["projects.project_id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["created_by"], ["users.user_id"], ondelete="SET NULL"),
        )
    if "task_comments" not in tables:
        op.create_table(
            "task_comments",
            sa.Column("comment_id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("author_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.ForeignKeyConstraint(["organization_id"], ["organizations.organization_id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["task_id"], ["tasks.task_id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["author_id"], ["users.user_id"], ondelete="SET NULL"),
        )
    if "task_activity" not in tables:
        op.create_table(
            "task_activity",
            sa.Column("activity_id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("event_type", sa.String(40), nullable=False),
            sa.Column("details", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.ForeignKeyConstraint(["organization_id"], ["organizations.organization_id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["task_id"], ["tasks.task_id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["actor_id"], ["users.user_id"], ondelete="SET NULL"),
        )

    _add_column_if_missing("tasks", "task_type", sa.Column("task_type", sa.String(20), nullable=False, server_default="TASK"))
    _add_column_if_missing("tasks", "story_points", sa.Column("story_points", sa.Integer(), nullable=True))
    _add_column_if_missing("tasks", "sprint_id", sa.Column("sprint_id", postgresql.UUID(as_uuid=True), nullable=True))

    constraints = {item["name"] for item in inspect(connection).get_foreign_keys("tasks")}
    if "fk_tasks_sprint_id_task_sprints" not in constraints:
        op.create_foreign_key("fk_tasks_sprint_id_task_sprints", "tasks", "task_sprints", ["sprint_id"], ["sprint_id"], ondelete="SET NULL")

    for table, index_name, column in (
        ("task_sprints", "ix_task_sprints_project_id", "project_id"),
        ("task_sprints", "ix_task_sprints_status", "status"),
        ("task_comments", "ix_task_comments_task_id", "task_id"),
        ("task_activity", "ix_task_activity_task_id", "task_id"),
        ("tasks", "ix_tasks_sprint_id", "sprint_id"),
    ):
        connection.exec_driver_sql(f'CREATE INDEX IF NOT EXISTS "{index_name}" ON "{table}" ("{column}")')
    connection.exec_driver_sql(
        'CREATE UNIQUE INDEX IF NOT EXISTS "uq_task_sprints_one_active_per_project" '
        'ON "task_sprints" ("project_id") WHERE "status" = \'ACTIVE\''
    )


def downgrade() -> None:
    raise RuntimeError("Restore a verified database backup to reverse this data-preserving migration.")
