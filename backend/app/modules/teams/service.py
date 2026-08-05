from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.teams.model import (
    Team,
    TeamMember,
)
from app.modules.teams.schema import (
    TeamCreate,
    TeamUpdate,
    TeamMemberCreate,
    TeamMemberUpdate,
)


# ==========================================================
# Teams
# ==========================================================

def get_teams(
    db: Session,
    skip: int = 0,
    limit: int = 100,
):
    """
    Get all teams.
    """
    return (
        db.query(Team)
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_team(
    db: Session,
    team_id: UUID,
):
    """
    Get a team by ID.
    """
    team = db.get(
        Team,
        team_id,
    )

    if team is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found",
        )

    return team


def create_team(
    db: Session,
    payload: TeamCreate,
):
    """
    Create a new team.
    """
    team = Team(
        **payload.model_dump()
    )

    db.add(team)
    db.commit()
    db.refresh(team)

    return team


def update_team(
    db: Session,
    team_id: UUID,
    payload: TeamUpdate,
):
    """
    Update an existing team.
    """
    team = db.get(
        Team,
        team_id,
    )

    if team is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found",
        )

    for field, value in payload.model_dump(
        exclude_unset=True
    ).items():
        setattr(
            team,
            field,
            value,
        )

    db.commit()
    db.refresh(team)

    return team


def delete_team(
    db: Session,
    team_id: UUID,
):
    """
    Delete a team.
    """
    team = db.get(
        Team,
        team_id,
    )

    if team is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found",
        )

    db.delete(team)
    db.commit()

    return None


# ==========================================================
# Team Members
# ==========================================================

def get_team_members(
    db: Session,
    team_id: UUID,
):
    """
    Get all members of a team.
    """
    team = db.get(
        Team,
        team_id,
    )

    if team is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found",
        )

    return (
        db.query(TeamMember)
        .filter(TeamMember.team_id == team_id)
        .all()
    )


def add_team_member(
    db: Session,
    team_id: UUID,
    payload: TeamMemberCreate,
):
    """
    Add a member to a team.
    """
    team = db.get(
        Team,
        team_id,
    )

    if team is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found",
        )

    member = TeamMember(
        **{
            **payload.model_dump(),
            "team_id": team_id,
        }
    )

    db.add(member)
    db.commit()
    db.refresh(member)

    return member


def update_team_member(
    db: Session,
    team_id: UUID,
    member_id: UUID,
    payload: TeamMemberUpdate,
):
    """
    Update a team member.
    """
    member = db.get(
        TeamMember,
        member_id,
    )

    if member is None or member.team_id != team_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team member not found",
        )

    for field, value in payload.model_dump(
        exclude_unset=True
    ).items():
        setattr(
            member,
            field,
            value,
        )

    db.commit()
    db.refresh(member)

    return member


def remove_team_member(
    db: Session,
    team_id: UUID,
    member_id: UUID,
):
    """
    Remove a member from a team.
    """
    member = db.get(
        TeamMember,
        member_id,
    )

    if member is None or member.team_id != team_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team member not found",
        )

    db.delete(member)
    db.commit()

    return None