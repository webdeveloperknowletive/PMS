"""Assign existing projects to their first recorded team lead."""

from alembic import op


revision = "20261014_03"
down_revision = "20261014_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
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
    pass
