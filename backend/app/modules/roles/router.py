from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.modules.roles import service
from app.modules.roles.schema import (
    RoleCreate,
    RoleRead,
    RoleUpdate,
    UserRoleCreate,
    UserRoleRead,
)
from app.modules.roles.permissions import can_manage_roles

router = APIRouter(
    prefix="/roles",
    tags=["Roles"]
)


@router.get("/", response_model=list[RoleRead], status_code=status.HTTP_200_OK)
async def get_roles(
    skip: int = 0,
    limit: int = 100,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_roles(db, skip=skip, limit=limit)


@router.get("/{role_id}", response_model=RoleRead, status_code=status.HTTP_200_OK)
async def get_role(
    role_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_role(db, role_id)


@router.post("/", response_model=RoleRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(can_manage_roles)])
async def create_role(
    payload: RoleCreate,
    db: Session = Depends(get_db),
):
    return service.create_role(db, payload)


@router.put("/{role_id}", response_model=RoleRead, status_code=status.HTTP_200_OK, dependencies=[Depends(can_manage_roles)])
async def update_role(
    role_id: UUID,
    payload: RoleUpdate,
    db: Session = Depends(get_db),
):
    return service.update_role(db, role_id, payload)


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(can_manage_roles)])
async def delete_role(
    role_id: UUID,
    db: Session = Depends(get_db),
):
    service.delete_role(db, role_id)


# ==========================================================
# User <-> Role Assignments
# ==========================================================

@router.get("/users/{user_id}", response_model=list[UserRoleRead], status_code=status.HTTP_200_OK)
async def get_user_roles(
    user_id: UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_user_roles(db, user_id)


@router.post("/users/{user_id}", response_model=UserRoleRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(can_manage_roles)])
async def assign_role_to_user(
    user_id: UUID,
    payload: UserRoleCreate,
    db: Session = Depends(get_db),
):
    return service.assign_role_to_user(db, user_id, payload)


@router.delete("/users/{user_id}/{role_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(can_manage_roles)])
async def remove_role_from_user(
    user_id: UUID,
    role_id: UUID,
    db: Session = Depends(get_db),
):
    service.remove_role_from_user(db, user_id, role_id)
