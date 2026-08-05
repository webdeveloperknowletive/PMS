"""
==========================================================
                TEAMS REPOSITORY
==========================================================

Data-access layer for TeamLead, Team and TeamMember.
"""

# ==========================================================
# Import Required Modules
# ==========================================================

from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.teams.model import Team, TeamLead, TeamMember
from app.modules.teams.schema import (
    TeamCreate,
    TeamLeadCreate,
    TeamMemberCreate,
    TeamMemberUpdate,
    TeamUpdate,
)


# ==========================================================
# Team Lead
# ==========================================================

def create_team_lead(
    db: Session,
    payload: TeamLeadCreate,
) -> TeamLead:

    team_lead = TeamLead(**payload.model_dump())

    db.add(team_lead)
    db.commit()
    db.refresh(team_lead)

    return team_lead


def get_team_lead(
    db: Session,
    team_lead_id: UUID,
) -> TeamLead | None:

    return db.get(TeamLead, team_lead_id)


def get_team_lead_by_user(
    db: Session,
    user_id: UUID,
) -> TeamLead | None:

    return (
        db.query(TeamLead)
        .filter(TeamLead.user_id == user_id)
        .first()
    )


def get_team_leads(
    db: Session,
    skip: int = 0,
    limit: int = 100,
) -> list[TeamLead]:

    return (
        db.query(TeamLead)
        .offset(skip)
        .limit(limit)
        .all()
    )


def delete_team_lead(
    db: Session,
    team_lead_id: UUID,
) -> bool:

    team_lead = db.get(TeamLead, team_lead_id)

    if team_lead is None:
        return False

    db.delete(team_lead)
    db.commit()

    return True


# ==========================================================
# Team
# ==========================================================

def create_team(
    db: Session,
    payload: TeamCreate,
) -> Team:

    team = Team(**payload.model_dump())

    db.add(team)
    db.commit()
    db.refresh(team)

    return team


def get_team(
    db: Session,
    team_id: UUID,
) -> Team | None:

    return db.get(Team, team_id)


def get_teams(
    db: Session,
    skip: int = 0,
    limit: int = 100,
) -> list[Team]:

    return (
        db.query(Team)
        .order_by(Team.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_teams_by_project(
    db: Session,
    project_id: UUID,
) -> list[Team]:

    return (
        db.query(Team)
        .filter(Team.project_id == project_id)
        .all()
    )


def get_teams_by_lead(
    db: Session,
    team_lead_id: UUID,
) -> list[Team]:

    return (
        db.query(Team)
        .filter(Team.team_lead_id == team_lead_id)
        .all()
    )


def update_team(
    db: Session,
    team_id: UUID,
    payload: TeamUpdate,
) -> Team | None:

    team = db.get(Team, team_id)

    if team is None:
        return None

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(team, field, value)

    db.commit()
    db.refresh(team)

    return team


def delete_team(
    db: Session,
    team_id: UUID,
) -> bool:

    team = db.get(Team, team_id)

    if team is None:
        return False

    db.delete(team)
    db.commit()

    return True


# ==========================================================
# Team Member
# ==========================================================

def create_team_member(
    db: Session,
    payload: TeamMemberCreate,
) -> TeamMember:

    member = TeamMember(**payload.model_dump())

    db.add(member)
    db.commit()
    db.refresh(member)

    return member


def get_team_member(
    db: Session,
    member_id: UUID,
) -> TeamMember | None:

    return db.get(TeamMember, member_id)


def get_team_member_by_team_and_user(
    db: Session,
    team_id: UUID,
    user_id: UUID,
) -> TeamMember | None:

    return (
        db.query(TeamMember)
        .filter(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user_id,
        )
        .first()
    )


def get_members_by_team(
    db: Session,
    team_id: UUID,
) -> list[TeamMember]:

    return (
        db.query(TeamMember)
        .filter(TeamMember.team_id == team_id)
        .all()
    )


def get_memberships_by_user(
    db: Session,
    user_id: UUID,
) -> list[TeamMember]:

    return (
        db.query(TeamMember)
        .filter(TeamMember.user_id == user_id)
        .all()
    )


def count_members_by_team(
    db: Session,
    team_id: UUID,
) -> int:

    return (
        db.query(TeamMember)
        .filter(TeamMember.team_id == team_id)
        .count()
    )


def update_team_member(
    db: Session,
    member_id: UUID,
    payload: TeamMemberUpdate,
) -> TeamMember | None:

    member = db.get(TeamMember, member_id)

    if member is None:
        return None

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(member, field, value)

    db.commit()
    db.refresh(member)

    return member


def delete_team_member(
    db: Session,
    member_id: UUID,
) -> bool:

    member = db.get(TeamMember, member_id)

    if member is None:
        return False

    db.delete(member)
    db.commit()

    return True
