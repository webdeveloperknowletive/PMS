"""Add task start dates.

Revision ID: 20261019_24
Revises: 20261019_23
"""

from alembic import op
import sqlalchemy as sa


revision = "20261019_24"
down_revision = "20261019_23"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("start_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("tasks", "start_date")
