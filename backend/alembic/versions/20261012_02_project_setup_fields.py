"""Add project planning fields.

Revision ID: 20261012_02
Revises: 20261012_01
Create Date: 2026-10-12
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "20261012_02"
down_revision = "20261012_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    if connection.dialect.name != "postgresql":
        raise RuntimeError("SprintIX workspace migrations currently require PostgreSQL.")
    columns = {column["name"] for column in inspect(connection).get_columns("projects")}
    if "priority" not in columns:
        op.add_column("projects", sa.Column("priority", sa.String(20), nullable=False, server_default="MEDIUM"))
    if "start_date" not in columns:
        op.add_column("projects", sa.Column("start_date", sa.Date(), nullable=True))
    if "due_date" not in columns:
        op.add_column("projects", sa.Column("due_date", sa.Date(), nullable=True))


def downgrade() -> None:
    raise RuntimeError("Restore a verified database backup to reverse this data-preserving migration.")
