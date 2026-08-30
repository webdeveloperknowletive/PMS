from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.modules.milestones import service
from app.modules.milestones.schema import MilestoneCreate, MilestoneRead, MilestoneUpdate
from app.modules.milestones.permissions import can_manage_milestones, can_view_milestones

router = APIRouter(
    prefix="/milestones",
    tags=["Milestones"]
)


@router.get(
    "/",
    response_model=list[MilestoneRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_milestones)],
)
async def get_milestones(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return service.get_milestones(db, skip=skip, limit=limit)


@router.get(
    "/{milestone_id}",
    response_model=MilestoneRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_milestones)],
)
async def get_milestone(
    milestone_id: UUID,
    db: Session = Depends(get_db),
):
    return service.get_milestone(db, milestone_id)


@router.post(
    "/",
    response_model=MilestoneRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(can_manage_milestones)],
)
async def create_milestone(
    payload: MilestoneCreate,
    db: Session = Depends(get_db),
):
    return service.create_milestone(db, payload)


@router.put(
    "/{milestone_id}",
    response_model=MilestoneRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_manage_milestones)],
)
async def update_milestone(
    milestone_id: UUID,
    payload: MilestoneUpdate,
    db: Session = Depends(get_db),
):
    return service.update_milestone(db, milestone_id, payload)


@router.delete(
    "/{milestone_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(can_manage_milestones)],
)
async def delete_milestone(
    milestone_id: UUID,
    db: Session = Depends(get_db),
):
    service.delete_milestone(db, milestone_id)
