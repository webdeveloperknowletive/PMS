from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.modules.teams.model import Team, TeamMember
from app.modules.teams.schema import (
    TeamCreate,
    TeamMemberCreate,
    TeamMemberRead,
    TeamMemberUpdate,
    TeamRead,
    TeamUpdate,
)
from app.modules.teams.permissions import can_manage_team_membership, can_manage_teams, can_view_teams
from app.modules.users.model import User

router = APIRouter(
    prefix="/teams",
    tags=["Teams"]
)


@router.get(
    "/",
    response_model=list[TeamRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_teams)],
)
async def get_teams(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return db.query(Team).offset(skip).limit(limit).all()


@router.get(
    "/{team_id}",
    response_model=TeamRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_teams)],
)
async def get_team(
    team_id: UUID,
    db: Session = Depends(get_db),
):
    team = db.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    return team


@router.post(
    "/",
    response_model=TeamRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(can_manage_teams)],
)
async def create_team(
    payload: TeamCreate,
    db: Session = Depends(get_db),
):
    team = Team(**payload.model_dump())
    db.add(team)
    db.commit()
    db.refresh(team)
    return team


@router.put(
    "/{team_id}",
    response_model=TeamRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_manage_teams)],
)
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


@router.delete(
    "/{team_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(can_manage_teams)],
)
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

@router.get(
    "/{team_id}/members",
    response_model=list[TeamMemberRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_teams)],
)
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    team = db.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    # Only this team's own lead (or Admin/Project Manager) may add members —
    # team.team_lead is the TeamLead row, .user_id is the actual person.
    can_manage_team_membership(team_lead_user_id=team.team_lead.user_id, current_user=current_user, db=db)

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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    team = db.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    can_manage_team_membership(team_lead_user_id=team.team_lead.user_id, current_user=current_user, db=db)

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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    team = db.get(Team, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    can_manage_team_membership(team_lead_user_id=team.team_lead.user_id, current_user=current_user, db=db)

    member = db.get(TeamMember, member_id)
    if member is None or member.team_id != team_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team member not found")

    db.delete(member)
    db.commit()