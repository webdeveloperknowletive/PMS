"""Track sprint lifecycle times for historical reports.

Revision ID: 20261019_19
Revises: 20261019_18
"""

from alembic import op
import sqlalchemy as sa


revision = "20261019_19"
down_revision = "20261019_18"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("task_sprints", sa.Column("started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("task_sprints", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
    op.execute("""
        UPDATE task_sprints AS sprint
        SET started_at = COALESCE(
            (SELECT MIN(change.created_at)
             FROM task_sprint_scope_changes AS change
             WHERE change.sprint_id = sprint.sprint_id
               AND change.event_type = 'BASELINE'),
            sprint.updated_at)
        WHERE sprint.status IN ('ACTIVE', 'COMPLETED')
    """)
    op.execute("""
        UPDATE task_sprints
        SET completed_at = updated_at
        WHERE status = 'COMPLETED'
    """)
    # Existing active sprints that predate scope history begin reporting from
    # this migration. Their present task scope becomes an honest new baseline.
    op.execute("""
        INSERT INTO task_sprint_scope_changes
            (organization_id, sprint_id, task_id, task_name, actor_id,
             event_type, points_before, points_after, created_at)
        SELECT sprint.organization_id, sprint.sprint_id, task.task_id,
               task.task_name, NULL, 'BASELINE', NULL, task.story_points, now()
        FROM task_sprints AS sprint
        JOIN tasks AS task
          ON task.sprint_id = sprint.sprint_id
         AND task.organization_id = sprint.organization_id
        WHERE sprint.status = 'ACTIVE'
          AND NOT EXISTS (
              SELECT 1 FROM task_sprint_scope_changes AS change
              WHERE change.sprint_id = sprint.sprint_id
                AND change.event_type = 'BASELINE'
          )
    """)
    op.execute("""
        INSERT INTO task_sprint_scope_changes
            (organization_id, sprint_id, task_id, task_name, actor_id,
             event_type, points_before, points_after, created_at)
        SELECT sprint.organization_id, sprint.sprint_id, NULL,
               sprint.sprint_name, NULL, 'BASELINE', NULL, 0, now()
        FROM task_sprints AS sprint
        WHERE sprint.status = 'ACTIVE'
          AND NOT EXISTS (
              SELECT 1 FROM task_sprint_scope_changes AS change
              WHERE change.sprint_id = sprint.sprint_id
                AND change.event_type = 'BASELINE'
          )
    """)


def downgrade() -> None:
    op.drop_column("task_sprints", "completed_at")
    op.drop_column("task_sprints", "started_at")
