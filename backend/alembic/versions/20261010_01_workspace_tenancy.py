"""Add customer workspaces and scope existing records to a legacy workspace.

Revision ID: 20261010_01
Revises:
Create Date: 2026-10-10
"""

from alembic import op

from app.modules.organizations.bootstrap import migrate_organization_schema

revision = "20261010_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Data-preserving, but not safely reversible: removing tenant keys would
    # merge customer-owned data back into a shared namespace.
    migrate_organization_schema(op.get_bind())


def downgrade() -> None:
    raise RuntimeError(
        "Workspace tenancy migration cannot be downgraded automatically without risking customer data. "
        "Restore a verified database backup instead."
    )
