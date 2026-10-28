"""Add additional members to Kanban task cards.

Revision ID: 20261021_28
Revises: 20261021_27
"""

from uuid import uuid4

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20261021_28"
down_revision = "20261021_27"
branch_labels = None
depends_on = None


PERMISSION_CODE = "kanban.cards.members.manage"
PERMISSION_NAME = "Kanban cards: Manage members"
PERMISSION_DESCRIPTION = "Allow users to add or remove members from Kanban cards."
PERMISSION_CATEGORY = "Kanban cards"


def upgrade() -> None:
    op.create_table(
        "kanban_card_members",
        sa.Column("card_member_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("assigned_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("assigned_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.organization_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.task_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["assigned_by_user_id"], ["users.user_id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("card_member_id"),
        sa.UniqueConstraint("task_id", "user_id", name="uq_kanban_card_members_task_user"),
    )
    op.create_index("ix_kanban_card_members_organization_id", "kanban_card_members", ["organization_id"])
    op.create_index("ix_kanban_card_members_task_id", "kanban_card_members", ["task_id"])
    op.create_index("ix_kanban_card_members_user_id", "kanban_card_members", ["user_id"])

    connection = op.get_bind()
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
                "name": PERMISSION_NAME,
                "description": PERMISSION_DESCRIPTION,
                "category": PERMISSION_CATEGORY,
            })
        else:
            connection.execute(sa.text(
                "UPDATE permissions SET name=:name, description=:description, category=:category "
                "WHERE permission_id=:id"
            ), {
                "id": permission_id,
                "name": PERMISSION_NAME,
                "description": PERMISSION_DESCRIPTION,
                "category": PERMISSION_CATEGORY,
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
    op.drop_index("ix_kanban_card_members_user_id", table_name="kanban_card_members")
    op.drop_index("ix_kanban_card_members_task_id", table_name="kanban_card_members")
    op.drop_index("ix_kanban_card_members_organization_id", table_name="kanban_card_members")
    op.drop_table("kanban_card_members")
