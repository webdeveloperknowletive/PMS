"""Platform client provisioning and durable mutation audit.

Revision ID: 20261103_34
Revises: 20261031_33
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20261103_34"
down_revision = "20261031_33"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column("organization_invitations", "invited_by_user_id", existing_type=postgresql.UUID(as_uuid=True), nullable=True)
    op.create_table("platform_audit_events",
        sa.Column("event_id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("platform_admin_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("platform_admins.platform_admin_id", ondelete="SET NULL"), nullable=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_slug", sa.String(80), nullable=False),
        sa.Column("action", sa.String(40), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_platform_audit_events_organization_id", "platform_audit_events", ["organization_id"])


def downgrade():
    # Fail safely if platform-issued invitations still exist; never delete them.
    connection = op.get_bind()
    if connection.execute(sa.text("SELECT 1 FROM organization_invitations WHERE invited_by_user_id IS NULL LIMIT 1")).first():
        raise RuntimeError("Platform-issued invitations must be resolved before downgrading.")
    op.drop_table("platform_audit_events")
    op.alter_column("organization_invitations", "invited_by_user_id", existing_type=postgresql.UUID(as_uuid=True), nullable=False)
