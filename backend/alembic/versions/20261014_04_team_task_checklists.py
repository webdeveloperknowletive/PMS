"""Track task team ownership and member checklists.

Revision ID: 20261014_04
Revises: 20261014_03
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20261014_04"
down_revision = "20261014_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_tasks_team_id_teams", "tasks", "teams", ["team_id"], ["team_id"], ondelete="SET NULL"
    )
    op.create_index("ix_tasks_team_id", "tasks", ["team_id"])
    op.add_column(
        "tasks",
        sa.Column("checklist_items", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
    )


def downgrade() -> None:
    op.drop_column("tasks", "checklist_items")
    op.drop_index("ix_tasks_team_id", table_name="tasks")
    op.drop_constraint("fk_tasks_team_id_teams", "tasks", type_="foreignkey")
    op.drop_column("tasks", "team_id")
