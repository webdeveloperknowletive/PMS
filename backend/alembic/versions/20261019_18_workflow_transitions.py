"""Persist the allowed task status moves on each project workflow.

Revision ID: 20261019_18
Revises: 20261018_17
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20261019_18"
down_revision = "20261018_17"
branch_labels = None
depends_on = None


DEFAULT_TRANSITIONS = (
    "'{\"TODO\":[\"IN_PROGRESS\",\"BLOCKED\",\"CANCELLED\"],"
    "\"IN_PROGRESS\":[\"TODO\",\"IN_REVIEW\",\"BLOCKED\",\"DONE\",\"CANCELLED\"],"
    "\"IN_REVIEW\":[\"IN_PROGRESS\",\"BLOCKED\",\"DONE\"],"
    "\"DONE\":[\"IN_PROGRESS\"],"
    "\"BLOCKED\":[\"TODO\",\"IN_PROGRESS\",\"CANCELLED\"],"
    "\"CANCELLED\":[\"TODO\"]}'::jsonb"
)


def upgrade() -> None:
    op.add_column(
        "workflows",
        sa.Column(
            "allowed_transitions",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text(DEFAULT_TRANSITIONS),
        ),
    )


def downgrade() -> None:
    op.drop_column("workflows", "allowed_transitions")
