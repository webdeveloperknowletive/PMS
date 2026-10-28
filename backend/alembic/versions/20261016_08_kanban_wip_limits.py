"""Add optional WIP limits to Kanban columns.

Revision ID: 20261016_08
Revises: 20261016_07
"""

from alembic import op
import sqlalchemy as sa


revision = "20261016_08"
down_revision = "20261016_07"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("kanban_columns", sa.Column("wip_limit", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("kanban_columns", "wip_limit")
