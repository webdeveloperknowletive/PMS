"""Add task labels and preserve them in saved task filters.

Revision ID: 20261018_13
Revises: 20261018_12
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20261018_13"
down_revision = "20261018_12"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tasks",
        sa.Column(
            "labels",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )
    op.alter_column("tasks", "labels", server_default=None)
    op.add_column("saved_task_filters", sa.Column("label", sa.String(length=40), nullable=True))


def downgrade() -> None:
    op.drop_column("saved_task_filters", "label")
    op.drop_column("tasks", "labels")
