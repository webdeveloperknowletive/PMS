"""Add flexible permission for checklist item assignees and due dates.

Revision ID: 20261021_30
Revises: 20261021_29
"""

from uuid import uuid4

from alembic import op
import sqlalchemy as sa


revision = "20261021_30"
down_revision = "20261021_29"
branch_labels = None
depends_on = None

PERMISSION_CODE = "kanban.card_checklists.items.manage"


def upgrade() -> None:
    connection = op.get_bind()
    organizations = connection.execute(
        sa.text("SELECT organization_id FROM organizations")
    ).scalars().all()

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
                "name": "Checklist item details: Manage",
                "description": "Allow assigning a project team member and due date to checklist items.",
                "category": "Checklist item details",
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
