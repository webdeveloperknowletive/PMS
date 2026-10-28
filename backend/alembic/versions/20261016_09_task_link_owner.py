"""Add an optional project-scoped owner to blocking task links.

Revision ID: 20261016_09
Revises: 20261016_08
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20261016_09"
down_revision = "20261016_08"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("task_links", sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_task_links_owner_id_users", "task_links", "users", ["owner_id"], ["user_id"], ondelete="SET NULL",
    )
    op.create_index("ix_task_links_owner_id", "task_links", ["owner_id"])


def downgrade() -> None:
    op.drop_index("ix_task_links_owner_id", table_name="task_links")
    op.drop_constraint("fk_task_links_owner_id_users", "task_links", type_="foreignkey")
    op.drop_column("task_links", "owner_id")
