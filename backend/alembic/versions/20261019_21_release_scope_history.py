"""Record release membership changes for each work item.

Revision ID: 20261019_21
Revises: 20261019_20
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20261019_21"
down_revision = "20261019_20"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "project_release_scope_changes",
        sa.Column("scope_change_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("release_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("release_name", sa.String(length=150), nullable=False),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("task_name", sa.String(length=255), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("event_type", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("event_type IN ('BASELINE', 'ADDED', 'REMOVED')", name="ck_project_release_scope_changes_type"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.organization_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.project_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.task_id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["actor_id"], ["users.user_id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("scope_change_id"),
    )
    op.create_index("ix_project_release_scope_changes_organization_id", "project_release_scope_changes", ["organization_id"])
    op.create_index("ix_project_release_scope_changes_project_id", "project_release_scope_changes", ["project_id"])
    op.create_index("ix_project_release_scope_changes_release_id", "project_release_scope_changes", ["release_id"])
    op.create_index("ix_project_release_scope_changes_task_id", "project_release_scope_changes", ["task_id"])
    op.create_index("ix_project_release_scope_changes_created_at", "project_release_scope_changes", ["created_at"])
    op.execute("""
        INSERT INTO project_release_scope_changes
            (scope_change_id, organization_id, project_id, release_id,
             release_name, task_id, task_name, actor_id, event_type, created_at)
        SELECT gen_random_uuid(), task.organization_id, task.project_id,
               release.release_id, release.name, task.task_id, task.task_name,
               NULL, 'BASELINE', now()
        FROM tasks AS task
        JOIN project_releases AS release
          ON release.release_id = task.release_id
         AND release.project_id = task.project_id
         AND release.organization_id = task.organization_id
    """)


def downgrade() -> None:
    op.drop_index("ix_project_release_scope_changes_created_at", table_name="project_release_scope_changes")
    op.drop_index("ix_project_release_scope_changes_task_id", table_name="project_release_scope_changes")
    op.drop_index("ix_project_release_scope_changes_release_id", table_name="project_release_scope_changes")
    op.drop_index("ix_project_release_scope_changes_project_id", table_name="project_release_scope_changes")
    op.drop_index("ix_project_release_scope_changes_organization_id", table_name="project_release_scope_changes")
    op.drop_table("project_release_scope_changes")
