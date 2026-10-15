"""Compatibility revision retained in the chain for existing installations.

Revision ID: 20261013_01
Revises: 20261012_05

The former revision installed fixed role templates and rewrote custom roles.
Flexible RBAC replaces that policy; new installations keep existing role data
and let the next revision migrate only the permission catalog.
"""

from alembic import op

revision = "20261013_01"
down_revision = "20261012_05"
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
