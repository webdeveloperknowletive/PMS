from uuid import UUID

from fastapi import APIRouter, Body, Depends, File, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.modules.users import service
from app.modules.users.model import User
from app.modules.users.schema import UserCreate, UserRead, UserUpdate
from app.modules.users.permissions import can_manage_users, can_modify_user

router = APIRouter(
    prefix="/users",
    tags=["Users"]
)


@router.get("/", response_model=list[UserRead], status_code=status.HTTP_200_OK)
async def get_users(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_users(db, skip=skip, limit=limit)


@router.get("/{user_id}", response_model=UserRead, status_code=status.HTTP_200_OK)
async def get_user(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_user(db, user_id)


@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(can_manage_users)])
async def create_user(
    payload: UserCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.create_user(db, payload, actor=current_user)


@router.put("/{user_id}", response_model=UserRead, status_code=status.HTTP_200_OK)
async def update_user(
    user_id: UUID,
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Fetch first (raises 404 via service) so an update against a
    # nonexistent user reports 404, not a permission error.
    service.get_user(db, user_id)
    can_modify_user(target_user_id=user_id, current_user=current_user, db=db)
    return service.update_user(db, user_id, payload, actor=current_user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(can_manage_users)])
async def delete_user(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service.delete_user(db, user_id, actor=current_user)


@router.patch("/{user_id}/status", response_model=UserRead, status_code=status.HTTP_200_OK, dependencies=[Depends(can_manage_users)])
async def update_user_status(
    user_id: UUID,
    is_active: bool = Body(..., embed=True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.update_user_status(db, user_id, is_active, actor=current_user)


@router.patch("/{user_id}/password", response_model=UserRead, status_code=status.HTTP_200_OK)
async def change_password(
    user_id: UUID,
    new_password: str = Body(..., embed=True, min_length=8),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service.get_user(db, user_id)
    can_modify_user(target_user_id=user_id, current_user=current_user, db=db)
    return service.change_password(db, user_id, new_password)


@router.patch("/{user_id}/profile", response_model=UserRead, status_code=status.HTTP_200_OK)
async def update_profile(
    user_id: UUID,
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service.get_user(db, user_id)
    can_modify_user(target_user_id=user_id, current_user=current_user, db=db)
    return service.update_profile(db, user_id, payload, actor=current_user)


@router.put("/{user_id}/profile-picture", response_model=UserRead)
async def update_profile_picture(
    user_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    can_modify_user(target_user_id=user_id, current_user=current_user, db=db)
    return await service.update_profile_picture(db, user_id, file, actor=current_user)


@router.delete("/{user_id}/profile-picture", response_model=UserRead)
async def remove_profile_picture(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    can_modify_user(target_user_id=user_id, current_user=current_user, db=db)
    return service.remove_profile_picture(db, user_id, actor=current_user)


@router.get("/{user_id}/profile-picture")
async def get_profile_picture(
    user_id: UUID,
    _current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    path, mime_type = service.get_profile_picture_path(db, user_id)
    return FileResponse(path, media_type=mime_type)
