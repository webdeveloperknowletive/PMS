"""
Permissions for the teams module.

- Admin / Project Manager manage teams and promote users to Team Lead.
- A Team Lead may manage membership of the team(s) they lead.
- Everyone authenticated may read team data.
"""

from fastapi import Depends
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenException
from app.core.permissions import has_permission
from app.modules.teams.model import TeamLead
from app.modules.users.model import User


def can_manage_teams(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Admin / Project Manager only: create/update/delete a team, or
    promote a user to Team Lead.
    """

    if not has_permission(db, current_user, "teams.manage"):
        raise ForbiddenException(message="Missing required permission: teams.manage")

    return current_user


def can_create_team(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """Allow CRUD-authorized users and designated leads to create their own project's team."""
    if has_permission(db, current_user, "teams.create"):
        return current_user

    is_designated_lead = db.query(TeamLead.team_lead_id).filter(
        TeamLead.user_id == current_user.user_id
    ).first() is not None
    if is_designated_lead and has_permission(db, current_user, "teams.members.manage"):
        # The service further limits this lead to projects where they are assigned.
        return current_user

    raise ForbiddenException(message="You do not have permission to create a team")


def can_manage_team_membership(
    team_lead_user_id,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Admin / Project Manager may manage any team's membership; the
    Team Lead of a given team may manage membership for that team only.
    """

    if has_permission(db, current_user, "roles.manage"):
        return current_user

    is_designated_lead = db.query(TeamLead.team_lead_id).filter(
        TeamLead.user_id == current_user.user_id
    ).first() is not None
    if has_permission(db, current_user, "teams.manage") and not is_designated_lead:
        return current_user

    if team_lead_user_id == current_user.user_id and has_permission(db, current_user, "teams.members.manage"):
        return current_user

    raise ForbiddenException(
        message="You may only manage membership for a team you lead"
    )


def can_view_teams(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Require team management or team membership access.
    """

    if not any(has_permission(db, current_user, code) for code in ("teams.view", "teams.manage", "teams.members.manage", "teams.leads.view")):
        raise ForbiddenException(message="You do not have access to teams")
    return current_user
