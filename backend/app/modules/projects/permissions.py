"""
Permissions for the projects module.

Projects are the top-level container the whole app hangs off of, so
creating, updating, or deleting one is restricted to management roles.
Everyone authenticated may read project data.
"""

from fastapi import Depends
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenException
from app.core.permissions import has_permission, require_permission
from app.modules.teams.model import Team, TeamLead, TeamMember
from app.modules.users.model import User


def can_manage_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Admin / Project Manager only: create, update, or delete a project.
    """

    return require_permission("projects.manage")(current_user, db)


def can_view_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Require project or task delivery access to view project data.
    """

    if any(has_permission(db, current_user, code) for code in ("projects.view", "projects.manage", "tasks.view", "tasks.team_view", "tasks.manage", "tasks.update_assigned", "gantt.view", "gantt.manage", "roles.manage")):
        return current_user

    # A Team Lead needs project read access to open the projects explicitly
    # assigned to their delivery team, even when their role has no global
    # projects.view grant. Keep this path scoped to actual team assignments.
    can_read_teams = any(has_permission(db, current_user, code) for code in (
        "teams.view", "teams.manage", "teams.leads.view", "teams.members.view", "teams.members.manage",
    ))
    if can_read_teams:
        assigned_lead = db.query(Team.team_id).join(
            TeamLead, TeamLead.team_lead_id == Team.team_lead_id,
        ).filter(TeamLead.user_id == current_user.user_id).first()
        assigned_member = db.query(Team.team_id).join(
            TeamMember, TeamMember.team_id == Team.team_id,
        ).filter(TeamMember.user_id == current_user.user_id).first()
        if assigned_lead or assigned_member:
            return current_user

    raise ForbiddenException(message="You do not have access to projects")
