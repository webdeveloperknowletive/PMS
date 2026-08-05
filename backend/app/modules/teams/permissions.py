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
from app.core.permissions import MANAGEMENT_ROLES, ROLE_TEAM_LEAD, user_has_any_role
from app.modules.users.model import User


def can_manage_teams(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Admin / Project Manager only: create/update/delete a team, or
    promote a user to Team Lead.
    """

    if not user_has_any_role(db, current_user, MANAGEMENT_ROLES):
        raise ForbiddenException(
            message=f"Requires one of the following roles: {', '.join(MANAGEMENT_ROLES)}"
        )

    return current_user


def can_manage_team_membership(
    team_lead_user_id,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Admin / Project Manager may manage any team's membership; the
    Team Lead of a given team may manage membership for that team only.
    """

    if user_has_any_role(db, current_user, MANAGEMENT_ROLES):
        return current_user

    if (
        current_user.user_id == team_lead_user_id
        and user_has_any_role(db, current_user, (ROLE_TEAM_LEAD,))
    ):
        return current_user

    raise ForbiddenException(
        message="You may only manage membership for a team you lead"
    )


def can_view_teams(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Any authenticated user may read team data.
    """

    return current_user
