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


def create_team(db: Session, payload: TeamCreate) -> Team:
    return repository.create_team(db, payload)


def update_team(db: Session, team_id: UUID, payload: TeamUpdate) -> Team:
    team = repository.update_team(db, team_id, payload)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    return team


def delete_team(db: Session, team_id: UUID) -> None:
    deleted = repository.delete_team(db, team_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")


# ==========================================================
# Team Members
# ==========================================================

def get_team_members(db: Session, team_id: UUID) -> list[TeamMember]:
    team = repository.get_team(db, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    return repository.get_members_by_team(db, team_id)


def add_team_member(db: Session, team_id: UUID, payload: TeamMemberCreate) -> TeamMember:
    team = repository.get_team(db, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    full_payload = TeamMemberCreate(
        team_id=team_id,
        user_id=payload.user_id,
        responsibility=payload.responsibility,
    )
    return repository.create_team_member(db, full_payload)


def update_team_member(db: Session, team_id: UUID, member_id: UUID, payload: TeamMemberUpdate) -> TeamMember:
    member = repository.get_team_member(db, member_id)
    if member is None or member.team_id != team_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team member not found")
    return repository.update_team_member(db, member_id, payload)


def remove_team_member(db: Session, team_id: UUID, member_id: UUID) -> None:
    member = repository.get_team_member(db, member_id)
    if member is None or member.team_id != team_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team member not found")
    repository.delete_team_member(db, member_id)
