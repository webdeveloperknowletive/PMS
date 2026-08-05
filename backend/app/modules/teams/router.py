from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.modules.teams.model import Team, TeamMember
from app.modules.teams.schema import (
    TeamCreate,
    TeamMemberCreate,
    TeamMemberRead,
    TeamMemberUpdate,
    TeamRead,
    TeamUpdate,
)

router = APIRouter(
    prefix="/teams",
    tags=["Teams"]
)


@router.get("/", response_model=list[TeamRead], status_code=status.HTTP_200_OK)
async def get_teams(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return db.query(Team).offset(skip).limit(limit).all()


@router.get("/{team_id}", response_model=TeamRead, status_code=status.HTTP_200_OK)
async def get_team(
    team_id: UUID,
    db: Session = Depends(get_db),
):
    team = db.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    return team


@router.post("/", response_model=TeamRead, status_code=status.HTTP_201_CREATED)
async def create_team(
    payload: TeamCreate,
    db: Session = Depends(get_db),
):
    team = Team(**payload.model_dump())
    db.add(team)
    db.commit()
    db.refresh(team)
    return team


@router.put("/{team_id}", response_model=TeamRead, status_code=status.HTTP_200_OK)
async def update_team(
    team_id: UUID,
    payload: TeamUpdate,
    db: Session = Depends(get_db),
):
    team = db.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(team, field, value)

    db.commit()
    db.refresh(team)
    return team


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team(
    team_id: UUID,
    db: Session = Depends(get_db),
):
    team = db.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    db.delete(team)
    db.commit()


# ==========================================================
# Team Members
# ==========================================================

@router.get("/{team_id}/members", response_model=list[TeamMemberRead], status_code=status.HTTP_200_OK)
async def get_team_members(
    team_id: UUID,
    db: Session = Depends(get_db),
):
    team = db.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    return db.query(TeamMember).filter(TeamMember.team_id == team_id).all()


@router.post("/{team_id}/members", response_model=TeamMemberRead, status_code=status.HTTP_201_CREATED)
async def add_team_member(
    team_id: UUID,
    payload: TeamMemberCreate,
    db: Session = Depends(get_db),
):
    team = db.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    member = TeamMember(**{**payload.model_dump(), "team_id": team_id})
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


@router.put("/{team_id}/members/{member_id}", response_model=TeamMemberRead, status_code=status.HTTP_200_OK)
async def update_team_member(
    team_id: UUID,
    member_id: UUID,
    payload: TeamMemberUpdate,
    db: Session = Depends(get_db),
):
    member = db.get(TeamMember, member_id)
    if member is None or member.team_id != team_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team member not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(member, field, value)

    db.commit()
    db.refresh(member)
    return member


@router.delete("/{team_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_team_member(
    team_id: UUID,
    member_id: UUID,
    db: Session = Depends(get_db),
):
    member = db.get(TeamMember, member_id)
    if member is None or member.team_id != team_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team member not found")

    db.delete(member)
    db.commit()
