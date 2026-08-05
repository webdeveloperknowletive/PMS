from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.modules.ai.task_estimation.model import AITaskEstimation
from app.modules.ai.task_estimation.schema import (
    AITaskEstimationCreate,
    AITaskEstimationRead,
    AITaskEstimationUpdate,
)

router = APIRouter(
    prefix="/ai/task-estimations",
    tags=["AI Task Estimation"]
)


@router.get("/", response_model=list[AITaskEstimationRead], status_code=status.HTTP_200_OK)
async def get_task_estimations(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return db.query(AITaskEstimation).offset(skip).limit(limit).all()


@router.get("/{estimation_id}", response_model=AITaskEstimationRead, status_code=status.HTTP_200_OK)
async def get_task_estimation(
    estimation_id: UUID,
    db: Session = Depends(get_db),
):
    estimation = db.get(AITaskEstimation, estimation_id)
    if estimation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task estimation not found")
    return estimation


@router.post("/", response_model=AITaskEstimationRead, status_code=status.HTTP_201_CREATED)
async def generate_task_estimation(
    payload: AITaskEstimationCreate,
    db: Session = Depends(get_db),
):
    estimation = AITaskEstimation(**payload.model_dump())
    db.add(estimation)
    db.commit()
    db.refresh(estimation)
    return estimation


@router.put("/{estimation_id}", response_model=AITaskEstimationRead, status_code=status.HTTP_200_OK)
async def update_task_estimation(
    estimation_id: UUID,
    payload: AITaskEstimationUpdate,
    db: Session = Depends(get_db),
):
    estimation = db.get(AITaskEstimation, estimation_id)
    if estimation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task estimation not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(estimation, field, value)

    db.commit()
    db.refresh(estimation)
    return estimation


@router.delete("/{estimation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task_estimation(
    estimation_id: UUID,
    db: Session = Depends(get_db),
):
    estimation = db.get(AITaskEstimation, estimation_id)
    if estimation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task estimation not found")

    db.delete(estimation)
    db.commit()
