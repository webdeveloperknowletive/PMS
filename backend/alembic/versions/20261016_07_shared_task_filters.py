"""Allow managers to share task filter presets within their workspace.

Revision ID: 20261016_07
Revises: 20261016_06
"""

from alembic import op
import sqlalchemy as sa


revision = "20261016_07"
down_revision = "20261016_06"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("saved_task_filters", sa.Column("is_shared", sa.Boolean(), nullable=False, server_default=sa.text("false")))


def downgrade() -> None:
    op.drop_column("saved_task_filters", "is_shared")
