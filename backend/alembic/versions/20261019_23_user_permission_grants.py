"""Add workspace scoped permission grants for individual users.

Revision ID: 20261019_23
Revises: 20261019_22
"""

from uuid import uuid4

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20261019_23"
down_revision = "20261019_22"
branch_labels = None
depends_on = None


USER_PERMISSION_CATALOG = (
    (
        "users.permissions.view",
        "User permissions: View",
        "Allow viewing a user's direct and role based permissions.",
        "User permissions",
    ),
    (
        "users.permissions.update",
        "User permissions: Update",
        "Allow assigning direct permissions to workspace users.",
        "User permissions",
    ),
)


def upgrade() -> None:
    op.create_table(
        "user_permissions",
        sa.Column("user_permission_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("permission_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("assigned_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("assigned_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.organization_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["permission_id"], ["permissions.permission_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["assigned_by_user_id"], ["users.user_id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("user_permission_id"),
        sa.UniqueConstraint("user_id", "permission_id", name="uq_user_permission"),
    )
    op.create_index("ix_user_permissions_organization_id", "user_permissions", ["organization_id"])
    op.create_index("ix_user_permissions_user_id", "user_permissions", ["user_id"])
    op.create_index("ix_user_permissions_permission_id", "user_permissions", ["permission_id"])

    connection = op.get_bind()
    organizations = connection.execute(sa.text(
        "SELECT organization_id FROM organizations"
    )).scalars().all()
    for organization_id in organizations:
        permission_ids = {}
        for code, name, description, category in USER_PERMISSION_CATALOG:
            permission_id = connection.execute(sa.text(
                "SELECT permission_id FROM permissions WHERE organization_id=:org AND code=:code"
            ), {"org": organization_id, "code": code}).scalar_one_or_none()
            if permission_id is None:
                permission_id = uuid4()
                connection.execute(sa.text(
                    "INSERT INTO permissions (permission_id, organization_id, code, name, description, category) "
                    "VALUES (:id, :org, :code, :name, :description, :category)"
                ), {"id": permission_id, "org": organization_id, "code": code, "name": name,
                    "description": description, "category": category})
            else:
                connection.execute(sa.text(
                    "UPDATE permissions SET name=:name, description=:description, category=:category "
                    "WHERE permission_id=:id"
                ), {"id": permission_id, "name": name, "description": description, "category": category})
            permission_ids[code] = permission_id

        # Preserve workspace administration: roles that can manage roles, and
        # protected system roles, can view and assign direct user permissions.
        administrator_role_ids = connection.execute(sa.text(
            "SELECT r.role_id FROM roles r "
            "WHERE r.organization_id=:org AND (r.is_system=TRUE OR EXISTS ("
            "SELECT 1 FROM role_permissions rp JOIN permissions p ON p.permission_id=rp.permission_id "
            "WHERE rp.role_id=r.role_id AND p.code='roles.manage'))"
        ), {"org": organization_id}).scalars().all()
        for role_id in administrator_role_ids:
            for permission_id in permission_ids.values():
                connection.execute(sa.text(
                    "INSERT INTO role_permissions (role_permission_id, organization_id, role_id, permission_id) "
                    "VALUES (:id, :org, :role, :permission) ON CONFLICT (role_id, permission_id) DO NOTHING"
                ), {"id": uuid4(), "org": organization_id, "role": role_id, "permission": permission_id})


def downgrade() -> None:
    connection = op.get_bind()
    codes = [code for code, *_ in USER_PERMISSION_CATALOG]
    connection.execute(sa.text(
        "DELETE FROM role_permissions WHERE permission_id IN ("
        "SELECT permission_id FROM permissions WHERE code IN :codes)"
    ).bindparams(sa.bindparam("codes", expanding=True)), {"codes": codes})
    connection.execute(sa.text(
        "DELETE FROM permissions WHERE code IN :codes"
    ).bindparams(sa.bindparam("codes", expanding=True)), {"codes": codes})
    op.drop_index("ix_user_permissions_permission_id", table_name="user_permissions")
    op.drop_index("ix_user_permissions_user_id", table_name="user_permissions")
    op.drop_index("ix_user_permissions_organization_id", table_name="user_permissions")
    op.drop_table("user_permissions")
