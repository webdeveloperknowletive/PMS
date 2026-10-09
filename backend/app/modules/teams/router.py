from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.modules.teams import service
from app.modules.teams.schema import (
    TeamCreate,
    TeamLeadCreate,
    TeamLeadRead,
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

# ==========================================================
# Team Leads
# ==========================================================

@router.get("/leads", response_model=list[TeamLeadRead], status_code=status.HTTP_200_OK)
async def get_team_leads(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_team_leads(db, skip=skip, limit=limit)


@router.get("/leads/by-user/{user_id}", response_model=TeamLeadRead, status_code=status.HTTP_200_OK)
async def get_team_lead_by_user(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_team_lead_by_user(db, user_id)


@router.get("/leads/{team_lead_id}", response_model=TeamLeadRead, status_code=status.HTTP_200_OK)
async def get_team_lead(
    team_lead_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_team_lead(db, team_lead_id)


@router.post(
    "/leads",
    response_model=TeamLeadRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(can_manage_teams)],
)
async def create_team_lead(
    payload: TeamLeadCreate,
    db: Session = Depends(get_db),
):
    return service.create_team_lead(db, payload)


@router.delete(
    "/leads/{team_lead_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(can_manage_teams)],
)
async def delete_team_lead(
    team_lead_id: UUID,
    db: Session = Depends(get_db),
):
    service.delete_team_lead(db, team_lead_id)


# ==========================================================
# Teams
# ==========================================================

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
    return service.get_teams(db, skip=skip, limit=limit)


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
    return service.get_team(db, team_id)


@router.post(
    "/",
    response_model=TeamRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(can_manage_teams)],
)
async def create_team(
    payload: TeamCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.create_team(db, payload, actor=current_user)


@router.put(
    "/{team_id}",
    response_model=TeamRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_manage_teams)],
)
async def update_team(
    team_id: UUID,
    payload: TeamUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.update_team(db, team_id, payload, actor=current_user)


@router.delete(
    "/{team_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(can_manage_teams)],
)
async def delete_team(
    team_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service.delete_team(db, team_id, actor=current_user)


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
    return service.get_team_members(db, team_id)


@router.post("/{team_id}/members", response_model=TeamMemberRead, status_code=status.HTTP_201_CREATED)
async def add_team_member(
    team_id: UUID,
    payload: TeamMemberCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    team = service.get_team(db, team_id)
    can_manage_team_membership(team_lead_user_id=team.team_lead.user_id, current_user=current_user, db=db)
    return service.add_team_member(db, team_id, payload, actor=current_user)


@router.put("/{team_id}/members/{member_id}", response_model=TeamMemberRead, status_code=status.HTTP_200_OK)
async def update_team_member(
    team_id: UUID,
    member_id: UUID,
    payload: TeamMemberUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    team = service.get_team(db, team_id)
    can_manage_team_membership(team_lead_user_id=team.team_lead.user_id, current_user=current_user, db=db)
    return service.update_team_member(db, team_id, member_id, payload, actor=current_user)


@router.delete("/{team_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_team_member(
    team_id: UUID,
    member_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    team = service.get_team(db, team_id)
    can_manage_team_membership(team_lead_user_id=team.team_lead.user_id, current_user=current_user, db=db)
    service.remove_team_member(db, team_id, member_id, actor=current_user)
