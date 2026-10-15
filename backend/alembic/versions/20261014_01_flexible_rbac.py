"""Make workspace roles editable and add per-action permissions.

Revision ID: 20261014_01
Revises: 20261013_01
"""

from uuid import uuid4

from alembic import op
import sqlalchemy as sa

from app.core.permissions import PERMISSION_CATALOG

revision = "20261014_01"
down_revision = "20261013_01"
branch_labels = None
depends_on = None


LEGACY_PERMISSION_EXPANSIONS = {
    "organization.manage": ["organizations.update"],
    "invitations.manage": ["invitations.view", "invitations.create", "invitations.update", "invitations.delete", "invitations.resend"],
    "users.manage": ["users.view", "users.create", "users.update", "users.delete", "users.status.update", "users.password.update"],
    "roles.manage": [
        "roles.manage",
        "roles.view", "roles.create", "roles.update", "roles.delete",
        "roles.assignments.view", "roles.assignments.create", "roles.assignments.delete",
        "roles.permissions.view", "roles.permissions.update",
    ],
    "projects.manage": ["projects.create", "projects.update", "projects.delete"],
    "teams.manage": ["teams.view", "teams.create", "teams.update", "teams.delete", "teams.leads.create", "teams.leads.delete"],
    "teams.members.manage": ["teams.members.view", "teams.members.create", "teams.members.update", "teams.members.delete"],
    "tasks.manage": [
        "tasks.view", "tasks.create", "tasks.update", "tasks.delete",
        "tasks.sprints.view", "tasks.sprints.create", "tasks.sprints.update", "tasks.sprints.delete",
        "tasks.comments.view", "tasks.comments.create", "tasks.activity.view", "tasks.subtasks.view",
        "tasks.work_sessions.view", "tasks.work_sessions.start", "tasks.work_sessions.stop", "tasks.work_time.view",
    ],
    "tasks.team_view": ["tasks.view", "tasks.comments.view", "tasks.activity.view", "tasks.subtasks.view"],
    "tasks.update_assigned": ["tasks.update_assigned", "tasks.work_sessions.start", "tasks.work_sessions.stop"],
    "workflow.manage": ["workflow.create", "workflow.update", "workflow.delete"],
    "kanban.manage": ["kanban.columns.create", "kanban.columns.update", "kanban.columns.delete", "kanban.tasks.create", "kanban.tasks.delete"],
    "kanban.move": ["kanban.tasks.move"],
    "kanban.view": ["kanban.columns.view", "kanban.tasks.view"],
    "gantt.manage": ["gantt.create", "gantt.update", "gantt.delete"],
    "milestones.manage": ["milestones.create", "milestones.update", "milestones.delete"],
    "documents.upload": ["documents.create", "documents.upload"],
    "documents.delete": ["documents.delete"],
    "documents.view": ["documents.view"],
    "calendar.create": ["calendar.create"],
    "calendar.manage": ["calendar.update", "calendar.delete"],
    "calendar.view": ["calendar.view"],
    "reports.manage": ["reports.create", "reports.update", "reports.delete"],
    "reports.view": ["reports.view"],
    "ai.use": [
        "ai.sprint_plans.generate", "ai.risk_predictions.generate", "ai.documentation.generate",
        "ai.task_estimations.generate", "ai.meeting_summaries.generate",
    ],
    "ai.view": [
        "ai.sprint_plans.view", "ai.risk_predictions.view", "ai.documentation.view",
        "ai.task_estimations.view", "ai.meeting_summaries.view",
    ],
}


def upgrade() -> None:
    op.add_column("roles", sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.false()))
    connection = op.get_bind()
    connection.execute(sa.text(
        "UPDATE roles SET is_system = TRUE WHERE role_name IN ('Super Admin', 'Workspace Owner')"
    ))

    workspaces = connection.execute(sa.text("SELECT organization_id FROM organizations")).scalars().all()
    for organization_id in workspaces:
        permission_ids = {}
        for code, name, description, category in PERMISSION_CATALOG:
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
                    "UPDATE permissions SET name=:name, description=:description, category=:category WHERE permission_id=:id"
                ), {"id": permission_id, "name": name, "description": description,
                    "category": category})
            permission_ids[code] = permission_id

        legacy_rows = connection.execute(sa.text(
            "SELECT permission_id, code FROM permissions WHERE organization_id=:org"
        ), {"org": organization_id}).mappings().all()
        for old_permission in legacy_rows:
            if old_permission["code"] in permission_ids:
                continue
            targets = LEGACY_PERMISSION_EXPANSIONS.get(old_permission["code"], [])
            role_ids = connection.execute(sa.text(
                "SELECT role_id FROM role_permissions WHERE organization_id=:org AND permission_id=:permission"
            ), {"org": organization_id, "permission": old_permission["permission_id"]}).scalars().all()
            for target_code in targets:
                target_permission_id = permission_ids.get(target_code)
                if target_permission_id is None:
                    continue
                for role_id in role_ids:
                    connection.execute(sa.text(
                        "INSERT INTO role_permissions (role_permission_id, organization_id, role_id, permission_id) "
                        "VALUES (:id, :org, :role, :permission) ON CONFLICT (role_id, permission_id) DO NOTHING"
                    ), {"id": uuid4(), "org": organization_id, "role": role_id,
                        "permission": target_permission_id})
            connection.execute(sa.text("DELETE FROM permissions WHERE permission_id=:id"),
                               {"id": old_permission["permission_id"]})

        system_role_ids = connection.execute(sa.text(
            "SELECT role_id FROM roles WHERE organization_id=:org AND is_system=TRUE"
        ), {"org": organization_id}).scalars().all()
        for role_id in system_role_ids:
            for permission_id in permission_ids.values():
                connection.execute(sa.text(
                    "INSERT INTO role_permissions (role_permission_id, organization_id, role_id, permission_id) "
                    "VALUES (:id, :org, :role, :permission) ON CONFLICT (role_id, permission_id) DO NOTHING"
                ), {"id": uuid4(), "org": organization_id, "role": role_id, "permission": permission_id})


def downgrade() -> None:
    raise RuntimeError("Flexible role grants and permission conversions are not safely reversible; restore a verified backup instead.")
