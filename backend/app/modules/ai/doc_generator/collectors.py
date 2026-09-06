"""
==========================================================
                PMS DATA COLLECTORS
==========================================================

Each collector pulls exactly the PMS data one document type
needs and returns a small, clean dict — never raw SQLAlchemy
rows, never more than what's relevant. Keeping "what data do
we have" (this file) separate from "how do we phrase it for
the AI" (prompts.py) and "what document type needs what"
(document_config.py) is what makes it possible to add a new
document type later without untangling all three concerns
at once.

Per the spec's data-privacy principle (section 24): a
collector never pulls unrelated data (e.g. all users, all
projects) — only what's scoped to the one project_id (or
task_id) it was asked about.
"""

from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.milestones.repository import get_milestones_by_project
from app.modules.projects.repository import get_project
from app.modules.tasks.repository import get_task, get_tasks_by_project
from app.modules.teams.repository import get_teams_by_project


def collect_project_data(db: Session, project_id: UUID) -> dict | None:
    """Returns None if the project doesn't exist — callers must check."""
    project = get_project(db, project_id)
    if project is None:
        return None

    return {
        "name": project.project_name,
        "description": project.description or "No description provided.",
        "status": project.status,
    }


def collect_task_data(db: Session, project_id: UUID) -> dict:
    """
    Summarizes every task in the project, grouped by status — not the
    raw rows. For a large project this keeps the prompt small (per
    spec section 35: don't blindly send thousands of raw records).
    """
    tasks = get_tasks_by_project(db, project_id, skip=0, limit=500)

    by_status: dict[str, list] = {}
    for task in tasks:
        by_status.setdefault(task.status, []).append(task)

    def _summaries(status: str) -> list[dict]:
        return [
            {"name": t.task_name, "description": t.description or ""}
            for t in by_status.get(status, [])
        ]

    return {
        "total": len(tasks),
        "counts_by_status": {status: len(items) for status, items in by_status.items()},
        "completed": _summaries("DONE"),
        "in_progress": _summaries("IN_PROGRESS"),
        "blocked": _summaries("BLOCKED"),
        "todo": _summaries("TODO"),
    }


def collect_single_task_data(db: Session, task_id: UUID) -> dict | None:
    """For the Task Description document type — one task, not a project-wide summary."""
    task = get_task(db, task_id)
    if task is None:
        return None

    return {
        "name": task.task_name,
        "existing_description": task.description or "(none yet)",
        "status": task.status,
        "priority": task.priority,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "assignee_name": task.assignee.name if task.assignee else None,
    }


def collect_team_data(db: Session, project_id: UUID) -> dict:
    """
    Team names, sizes, and lead — deliberately not every member's full
    profile (per spec section 24, only what's relevant to a document).
    """
    teams = get_teams_by_project(db, project_id)

    return {
        "team_count": len(teams),
        "teams": [
            {
                "name": team.team_name,
                "member_count": len(team.members),
                "lead_name": team.team_lead.user.name if team.team_lead and team.team_lead.user else None,
            }
            for team in teams
        ],
    }


def collect_milestone_data(db: Session, project_id: UUID) -> dict:
    milestones = get_milestones_by_project(db, project_id, skip=0, limit=200)

    return {
        "total": len(milestones),
        "completed": [
            {"title": m.title, "due_date": m.due_date.isoformat()}
            for m in milestones if m.is_completed
        ],
        "pending": [
            {"title": m.title, "due_date": m.due_date.isoformat()}
            for m in milestones if not m.is_completed
        ],
    }
