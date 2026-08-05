from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.modules.milestones.model import Milestone
from app.modules.milestones.schema import MilestoneCreate, MilestoneRead, MilestoneUpdate

router = APIRouter(
    prefix="/milestones",
    tags=["Milestones"]
)


@router.get("/", response_model=list[MilestoneRead], status_code=status.HTTP_200_OK)
async def get_milestones(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return db.query(Milestone).offset(skip).limit(limit).all()


@router.get("/{milestone_id}", response_model=MilestoneRead, status_code=status.HTTP_200_OK)
async def get_milestone(
    milestone_id: UUID,
    db: Session = Depends(get_db),
):
    milestone = db.get(Milestone, milestone_id)
    if milestone is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found")
    return milestone


@router.post("/", response_model=MilestoneRead, status_code=status.HTTP_201_CREATED)
async def create_milestone(
    payload: MilestoneCreate,
    db: Session = Depends(get_db),
):
    milestone = Milestone(**payload.model_dump())
    db.add(milestone)
    db.commit()
    db.refresh(milestone)
    return milestone


@router.put("/{milestone_id}", response_model=MilestoneRead, status_code=status.HTTP_200_OK)
async def update_milestone(
    milestone_id: UUID,
    payload: MilestoneUpdate,
    db: Session = Depends(get_db),
):
    milestone = db.get(Milestone, milestone_id)
    if milestone is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(milestone, field, value)

    db.commit()
    db.refresh(milestone)
    return milestone


@router.delete("/{milestone_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_milestone(
    milestone_id: UUID,
    db: Session = Depends(get_db),
):
    milestone = db.get(Milestone, milestone_id)
    if milestone is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found")

    db.delete(milestone)
    db.commit()
