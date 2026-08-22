from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.modules.roles import repository as roles_repository
from app.modules.roles.model import Role, TeamLead, UserRole
from app.modules.roles.schema import (
    RoleCreate,
    RoleRead,
    RoleUpdate,
    TeamLeadCreate,
    TeamLeadRead,
    UserRoleCreate,
    UserRoleRead,
)
from app.modules.roles.permissions import can_manage_roles

router = APIRouter(
    prefix="/roles",
    tags=["Roles"]
)

# ==========================================================
# Team Leads
# (kept exactly as wired up earlier — unrelated to this permissions pass)
# ==========================================================

@router.get("/leads", response_model=list[TeamLeadRead], status_code=status.HTTP_200_OK)
async def get_team_leads(
    skip: int = 0,
    limit: int = 100,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return roles_repository.get_team_leads(db, skip=skip, limit=limit)


@router.get("/leads/by-user/{user_id}", response_model=TeamLeadRead, status_code=status.HTTP_200_OK)
async def get_team_lead_by_user(
    user_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    team_lead = roles_repository.get_team_lead_by_user(db, user_id=user_id)
    if team_lead is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This user is not a team lead")
    return team_lead


@router.get("/leads/{team_lead_id}", response_model=TeamLeadRead, status_code=status.HTTP_200_OK)
async def get_team_lead(
    team_lead_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    team_lead = roles_repository.get_team_lead(db, team_lead_id=team_lead_id)
    if team_lead is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team lead not found")
    return team_lead


@router.post(
    "/leads",
    response_model=TeamLeadRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(can_manage_roles)],
)
async def create_team_lead(
    payload: TeamLeadCreate,
    db: Session = Depends(get_db),
):
    existing = roles_repository.get_team_lead_by_user(db, user_id=payload.user_id)
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This user is already a team lead")
    return roles_repository.create_team_lead(db, payload=payload)


@router.delete("/leads/{team_lead_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(can_manage_roles)])
async def delete_team_lead(
    team_lead_id: UUID,
    db: Session = Depends(get_db),
):
    deleted = roles_repository.delete_team_lead(db, team_lead_id=team_lead_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team lead not found")


# ==========================================================
# Roles
# ==========================================================

@router.get("/", response_model=list[RoleRead], status_code=status.HTTP_200_OK)
async def get_roles(
    skip: int = 0,
    limit: int = 100,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(Role).offset(skip).limit(limit).all()


@router.get("/{role_id}", response_model=RoleRead, status_code=status.HTTP_200_OK)
async def get_role(
    role_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    role = db.get(Role, role_id)
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    return role


@router.post("/", response_model=RoleRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(can_manage_roles)])
async def create_role(
    payload: RoleCreate,
    db: Session = Depends(get_db),
):
    role = Role(**payload.model_dump())
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@router.put("/{role_id}", response_model=RoleRead, status_code=status.HTTP_200_OK, dependencies=[Depends(can_manage_roles)])
async def update_role(
    role_id: UUID,
    payload: RoleUpdate,
    db: Session = Depends(get_db),
):
    role = db.get(Role, role_id)
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(role, field, value)

    db.commit()
    db.refresh(role)
    return role


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(can_manage_roles)])
async def delete_role(
    role_id: UUID,
    db: Session = Depends(get_db),
):
    role = db.get(Role, role_id)
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")

    db.delete(role)
    db.commit()


# ==========================================================
# User <-> Role Assignments
# ==========================================================

@router.get("/users/{user_id}", response_model=list[UserRoleRead], status_code=status.HTTP_200_OK)
async def get_user_roles(
    user_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(UserRole).filter(UserRole.user_id == user_id).all()


@router.post("/users/{user_id}", response_model=UserRoleRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(can_manage_roles)])
async def assign_role_to_user(
    user_id: UUID,
    payload: UserRoleCreate,
    db: Session = Depends(get_db),
):
    user_role = UserRole(**{**payload.model_dump(), "user_id": user_id})
    db.add(user_role)
    db.commit()
    db.refresh(user_role)
    return user_role


@router.delete("/users/{user_id}/{role_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(can_manage_roles)])
async def remove_role_from_user(
    user_id: UUID,
    role_id: UUID,
    db: Session = Depends(get_db),
):
    user_role = (
        db.query(UserRole)
        .filter(UserRole.user_id == user_id, UserRole.role_id == role_id)
        .first()
    )
    if user_role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role assignment not found")

    db.delete(user_role)
    db.commit()