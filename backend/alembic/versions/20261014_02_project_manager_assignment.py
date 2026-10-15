"""Persist a project manager separately from its team lead.

Revision ID: 20261014_02
Revises: 20261014_01
"""

from alembic import op
import sqlalchemy as sa


revision = "20261014_02"
down_revision = "20261014_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("project_manager_user_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        "fk_projects_project_manager_user_id_users",
        "projects",
        "users",
        ["project_manager_user_id"],
        ["user_id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_projects_project_manager_user_id",
        "projects",
        ["project_manager_user_id"],
        unique=False,
    )
    op.execute(
        """
        UPDATE projects AS project
        SET project_manager_user_id = (
            SELECT lead.user_id
            FROM teams AS team
            JOIN team_leads AS lead ON lead.team_lead_id = team.team_lead_id
            WHERE team.project_id = project.project_id
            ORDER BY team.created_at ASC
            LIMIT 1
        )
        WHERE project.project_manager_user_id IS NULL
        """
    )


def downgrade() -> None:
    op.drop_index("ix_projects_project_manager_user_id", table_name="projects")
    op.drop_constraint("fk_projects_project_manager_user_id_users", "projects", type_="foreignkey")
    op.drop_column("projects", "project_manager_user_id")
