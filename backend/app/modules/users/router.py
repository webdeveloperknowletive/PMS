from uuid import UUID

import bcrypt
from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.modules.users.model import User
from app.modules.users.schema import UserCreate, UserRead, UserUpdate

router = APIRouter(
    prefix="/users",
    tags=["Users"]
)


def _hash_password(plain_password: str) -> str:
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


@router.get("/", response_model=list[UserRead], status_code=status.HTTP_200_OK)
async def get_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return db.query(User).offset(skip).limit(limit).all()


@router.get("/{user_id}", response_model=UserRead, status_code=status.HTTP_200_OK)
async def get_user(
    user_id: UUID,
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
):
    data = payload.model_dump(exclude={"password"})
    user = User(**data, password_hash=_hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}", response_model=UserRead, status_code=status.HTTP_200_OK)
async def update_user(
    user_id: UUID,
    payload: UserUpdate,
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    db.delete(user)
    db.commit()


@router.patch("/{user_id}/status", response_model=UserRead, status_code=status.HTTP_200_OK)
async def update_user_status(
    user_id: UUID,
    is_active: bool = Body(..., embed=True),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.is_active = is_active
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}/password", response_model=UserRead, status_code=status.HTTP_200_OK)
async def change_password(
    user_id: UUID,
    new_password: str = Body(..., embed=True, min_length=8),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.password_hash = _hash_password(new_password)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}/profile", response_model=UserRead, status_code=status.HTTP_200_OK)
async def update_profile(
    user_id: UUID,
    payload: UserUpdate,
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user
