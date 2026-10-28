"""Use the latest baseline when a sprint is restarted.

Revision ID: 20261019_20
Revises: 20261019_19
"""

from alembic import op


revision = "20261019_20"
down_revision = "20261019_19"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        UPDATE task_sprints AS sprint
        SET started_at = (
            SELECT MAX(change.created_at)
            FROM task_sprint_scope_changes AS change
            WHERE change.sprint_id = sprint.sprint_id
              AND change.event_type = 'BASELINE'
        )
        WHERE sprint.status IN ('ACTIVE', 'COMPLETED')
          AND EXISTS (
              SELECT 1 FROM task_sprint_scope_changes AS change
              WHERE change.sprint_id = sprint.sprint_id
                AND change.event_type = 'BASELINE'
          )
    """)


def downgrade() -> None:
    # Previous start timestamps cannot be reconstructed once a sprint has
    # multiple baseline cycles, so no value-changing downgrade is available.
    pass
