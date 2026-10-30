"""Add platform-only administrator accounts.

Revision ID: 20261030_32
Revises: 20261021_31
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20261030_32"
down_revision = "20261021_31"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "platform_admins",
        sa.Column("platform_admin_id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_email_verified", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("email", name="uq_platform_admins_email"),
    )
    op.create_index("ix_platform_admins_email", "platform_admins", ["email"])
    op.create_table(
        "platform_admin_sessions",
        sa.Column("session_id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("platform_admin_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("platform_admins.platform_admin_id", ondelete="CASCADE"), nullable=False),
        sa.Column("refresh_token_hash", sa.String(length=128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ip_address", sa.String(length=50), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("refresh_token_hash", name="uq_platform_session_token"),
    )
    op.create_index("ix_platform_sessions_admin", "platform_admin_sessions", ["platform_admin_id"])


def downgrade() -> None:
    op.drop_index("ix_platform_sessions_admin", table_name="platform_admin_sessions")
    op.drop_table("platform_admin_sessions")
    op.drop_index("ix_platform_admins_email", table_name="platform_admins")
    op.drop_table("platform_admins")
