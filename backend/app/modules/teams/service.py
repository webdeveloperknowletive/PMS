"""
==========================================================
                TEAMS SERVICE
==========================================================

Business logic layer for Team Leads, Teams and Team
Members. Orchestrates calls to repository.py and
translates "not found" into HTTP errors. Routers should
only ever call this layer, never the model or repository
directly.
"""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.teams import repository
from app.modules.teams.model import Team, TeamLead, TeamMember
from app.modules.teams.schema import (
    TeamCreate,
    TeamLeadCreate,
    TeamMemberCreate,
    TeamMemberUpdate,
    TeamUpdate,
)
from app.modules.notifications.events import notify_project_users
from app.modules.users.model import User


# ==========================================================
# Team Leads
# ==========================================================

def get_team_leads(db: Session, skip: int = 0, limit: int = 100) -> list[TeamLead]:
    return repository.get_team_leads(db, skip=skip, limit=limit)


def get_team_lead(db: Session, team_lead_id: UUID) -> TeamLead:
    team_lead = repository.get_team_lead(db, team_lead_id)
    if team_lead is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team lead not found")
    return team_lead


def get_team_lead_by_user(db: Session, user_id: UUID) -> TeamLead:
    team_lead = repository.get_team_lead_by_user(db, user_id)
    if team_lead is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This user is not a team lead")
    return team_lead


def create_team_lead(db: Session, payload: TeamLeadCreate) -> TeamLead:
    existing = repository.get_team_lead_by_user(db, payload.user_id)
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This user is already a team lead")
    return repository.create_team_lead(db, payload)


def delete_team_lead(db: Session, team_lead_id: UUID) -> None:
    deleted = repository.delete_team_lead(db, team_lead_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team lead not found")


# ==========================================================
# Teams
# ==========================================================

def get_teams(db: Session, skip: int = 0, limit: int = 100) -> list[Team]:
    return repository.get_teams(db, skip=skip, limit=limit)


def get_team(db: Session, team_id: UUID) -> Team:
    team = repository.get_team(db, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    return team


def create_team(db: Session, payload: TeamCreate, actor: User) -> Team:
    team = repository.create_team(db, payload)
    lead = db.get(TeamLead, team.team_lead_id)
    notify_project_users(
        db, team.project_id, actor_id=actor.user_id,
        additional_user_ids=set(payload.member_user_ids) | ({lead.user_id} if lead else set()),
        title=f"Team created: {team.team_name}",
        message=f"{actor.name} created this team and set up its membership.",
        notification_type="Team Created",
    )
    return team


def update_team(db: Session, team_id: UUID, payload: TeamUpdate, actor: User) -> Team:
    current = get_team(db, team_id)
    team = repository.update_team(db, team_id, payload)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    target_ids = {member.user_id for member in current.members}
    lead = db.get(TeamLead, team.team_lead_id)
    if lead:
        target_ids.add(lead.user_id)
    notify_project_users(
        db, team.project_id, actor_id=actor.user_id, additional_user_ids=target_ids,
        title=f"Team updated: {team.team_name}",
        message=f"{actor.name} updated the team details.",
        notification_type="Team Updated",
    )
    return team


def delete_team(db: Session, team_id: UUID, actor: User) -> None:
    team = get_team(db, team_id)
    project_id, team_name = team.project_id, team.team_name
    recipient_ids = {member.user_id for member in team.members}
    lead = db.get(TeamLead, team.team_lead_id)
    if lead:
        recipient_ids.add(lead.user_id)
    deleted = repository.delete_team(db, team_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    notify_project_users(
        db, project_id, actor_id=actor.user_id, additional_user_ids=recipient_ids,
        title=f"Team deleted: {team_name}",
        message=f"{actor.name} deleted this team.",
        notification_type="Team Deleted",
    )


# ==========================================================
# Team Members
# ==========================================================

def get_team_members(db: Session, team_id: UUID) -> list[TeamMember]:
    team = repository.get_team(db, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    return repository.get_members_by_team(db, team_id)


def add_team_member(db: Session, team_id: UUID, payload: TeamMemberCreate, actor: User) -> TeamMember:
    team = repository.get_team(db, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    full_payload = TeamMemberCreate(
        team_id=team_id,
        user_id=payload.user_id,
        responsibility=payload.responsibility,
    )
    member = repository.create_team_member(db, full_payload)
    notify_project_users(
        db, team.project_id, actor_id=actor.user_id, additional_user_ids={payload.user_id},
        title=f"Added to team: {team.team_name}",
        message=f"{actor.name} added a member to the team.",
        notification_type="Team Membership",
    )
    return member


def update_team_member(db: Session, team_id: UUID, member_id: UUID, payload: TeamMemberUpdate, actor: User) -> TeamMember:
    member = repository.get_team_member(db, member_id)
    if member is None or member.team_id != team_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team member not found")
    updated = repository.update_team_member(db, member_id, payload)
    team = get_team(db, team_id)
    notify_project_users(
        db, team.project_id, actor_id=actor.user_id, additional_user_ids={member.user_id},
        title=f"Team responsibility updated: {team.team_name}",
        message=f"{actor.name} updated your team responsibility.",
        notification_type="Team Membership Updated",
    )
    return updated


def remove_team_member(db: Session, team_id: UUID, member_id: UUID, actor: User) -> None:
    member = repository.get_team_member(db, member_id)
    if member is None or member.team_id != team_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team member not found")
    team = get_team(db, team_id)
    removed_user_id = member.user_id
    repository.delete_team_member(db, member_id)
    notify_project_users(
        db, team.project_id, actor_id=actor.user_id, additional_user_ids={removed_user_id},
        title=f"Removed from team: {team.team_name}",
        message=f"{actor.name} removed a member from the team.",
        notification_type="Team Membership Removed",
    )
