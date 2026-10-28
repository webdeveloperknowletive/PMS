"""Add colored, organization-scoped Kanban label definitions.

Revision ID: 20261021_29
Revises: 20261021_28
"""

from uuid import uuid4

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20261021_29"
down_revision = "20261021_28"
branch_labels = None
depends_on = None

PERMISSION_CODE = "kanban.labels.manage"


def upgrade() -> None:
    op.create_table(
        "kanban_labels",
        sa.Column("label_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("label_key", sa.String(length=40), nullable=False),
        sa.Column("name", sa.String(length=40), nullable=False),
        sa.Column("color", sa.String(length=7), server_default="#64748B", nullable=False),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.organization_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.user_id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("label_id"),
        sa.UniqueConstraint("organization_id", "label_key", name="uq_kanban_labels_org_key"),
    )
    op.create_index("ix_kanban_labels_organization_id", "kanban_labels", ["organization_id"])

    connection = op.get_bind()
    old_labels = connection.execute(sa.text(
        "SELECT t.organization_id, lower(trim(label.value)) AS label_key "
        "FROM tasks t CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(t.labels, '[]'::jsonb)) AS label(value) "
        "WHERE trim(label.value) <> '' AND char_length(trim(label.value)) <= 40 "
        "GROUP BY t.organization_id, lower(trim(label.value))"
    )).mappings().all()
    for row in old_labels:
        connection.execute(sa.text(
            "INSERT INTO kanban_labels (label_id, organization_id, label_key, name, color) "
            "VALUES (:id, :org, :key, :name, '#64748B') ON CONFLICT (organization_id, label_key) DO NOTHING"
        ), {"id": uuid4(), "org": row["organization_id"], "key": row["label_key"], "name": row["label_key"]})

    organizations = connection.execute(sa.text("SELECT organization_id FROM organizations")).scalars().all()
    for organization_id in organizations:
        permission_id = connection.execute(sa.text(
            "SELECT permission_id FROM permissions WHERE organization_id=:org AND code=:code"
        ), {"org": organization_id, "code": PERMISSION_CODE}).scalar_one_or_none()
        if permission_id is None:
            permission_id = uuid4()
            connection.execute(sa.text(
                "INSERT INTO permissions (permission_id, organization_id, code, name, description, category) "
                "VALUES (:id, :org, :code, :name, :description, :category)"
            ), {
                "id": permission_id,
                "org": organization_id,
                "code": PERMISSION_CODE,
                "name": "Kanban labels: Manage catalog",
                "description": "Allow users to create or edit organization Kanban labels and their colors.",
                "category": "Kanban labels",
            })
        administrator_roles = connection.execute(sa.text(
            "SELECT r.role_id FROM roles r WHERE r.organization_id=:org AND (r.is_system=TRUE OR EXISTS ("
            "SELECT 1 FROM role_permissions rp JOIN permissions p ON p.permission_id=rp.permission_id "
            "WHERE rp.role_id=r.role_id AND p.code='roles.manage'))"
        ), {"org": organization_id}).scalars().all()
        for role_id in administrator_roles:
            connection.execute(sa.text(
                "INSERT INTO role_permissions (role_permission_id, organization_id, role_id, permission_id) "
                "VALUES (:id, :org, :role, :permission) ON CONFLICT (role_id, permission_id) DO NOTHING"
            ), {"id": uuid4(), "org": organization_id, "role": role_id, "permission": permission_id})


def downgrade() -> None:
    connection = op.get_bind()
    permission_ids = connection.execute(sa.text(
        "SELECT permission_id FROM permissions WHERE code=:code"
    ), {"code": PERMISSION_CODE}).scalars().all()
    if permission_ids:
        connection.execute(sa.text(
            "DELETE FROM role_permissions WHERE permission_id IN :ids"
        ).bindparams(sa.bindparam("ids", expanding=True)), {"ids": permission_ids})
        connection.execute(sa.text(
            "DELETE FROM user_permissions WHERE permission_id IN :ids"
        ).bindparams(sa.bindparam("ids", expanding=True)), {"ids": permission_ids})
        connection.execute(sa.text(
            "DELETE FROM permissions WHERE permission_id IN :ids"
        ).bindparams(sa.bindparam("ids", expanding=True)), {"ids": permission_ids})
    op.drop_index("ix_kanban_labels_organization_id", table_name="kanban_labels")
    op.drop_table("kanban_labels")
