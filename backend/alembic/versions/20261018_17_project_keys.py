"""Add stable, workspace-unique project keys.

Revision ID: 20261018_17
Revises: 20261018_16
"""

import re

from alembic import op
import sqlalchemy as sa


revision = "20261018_17"
down_revision = "20261018_16"
branch_labels = None
depends_on = None


def _base_key(project_name: str) -> str:
    words = re.findall(r"[A-Za-z0-9]+", project_name.upper())
    if not words:
        return "PROJ"
    key = "".join(word[0] for word in words[:6]) if len(words) > 1 else words[0][:4]
    return (key or "PROJ")[:12]


def upgrade() -> None:
    op.add_column("projects", sa.Column("project_key", sa.String(length=12), nullable=True))
    connection = op.get_bind()
    rows = connection.execute(sa.text(
        "SELECT project_id, organization_id, project_name FROM projects ORDER BY organization_id, created_at, project_id"
    )).mappings().all()
    used: dict[object, set[str]] = {}
    for row in rows:
        organization_id = row["organization_id"]
        organization_keys = used.setdefault(organization_id, set())
        base = _base_key(row["project_name"])
        key = base
        suffix = 2
        while key in organization_keys:
            suffix_text = str(suffix)
            key = f"{base[:12 - len(suffix_text)]}{suffix_text}"
            suffix += 1
        organization_keys.add(key)
        connection.execute(
            sa.text("UPDATE projects SET project_key = :project_key WHERE project_id = :project_id"),
            {"project_key": key, "project_id": row["project_id"]},
        )
    op.alter_column("projects", "project_key", nullable=False)
    op.create_unique_constraint(
        "uq_projects_organization_project_key", "projects", ["organization_id", "project_key"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_projects_organization_project_key", "projects", type_="unique")
    op.drop_column("projects", "project_key")
