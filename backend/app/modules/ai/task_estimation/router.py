from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.modules.ai.task_estimation import service
from app.modules.ai.task_estimation.schema import (
    AITaskEstimationCreate,
    AITaskEstimationRead,
    AITaskEstimationUpdate,
)
from app.modules.ai.task_estimation.permissions import can_generate, can_view_results

router = APIRouter(
    prefix="/ai/task-estimations",
    tags=["AI Task Estimation"]
)


@router.get(
    "/",
    response_model=list[AITaskEstimationRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_results)],
)
async def get_task_estimations(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return service.get_task_estimations(db, skip=skip, limit=limit)


@router.get(
    "/{estimation_id}",
    response_model=AITaskEstimationRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_results)],
)
async def get_task_estimation(
    estimation_id: UUID,
    db: Session = Depends(get_db),
):
    return service.get_task_estimation(db, estimation_id)


@router.post(
    "/",
    response_model=AITaskEstimationRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(can_generate)],
)
async def generate_task_estimation(
    payload: AITaskEstimationCreate,
    db: Session = Depends(get_db),
):
    return service.generate_task_estimation(db, payload)


@router.put(
    "/{estimation_id}",
    response_model=AITaskEstimationRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_generate)],
)
async def update_task_estimation(
    estimation_id: UUID,
    payload: AITaskEstimationUpdate,
    db: Session = Depends(get_db),
):
    return service.update_task_estimation(db, estimation_id, payload)


@router.delete(
    "/{estimation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(can_generate)],
)
async def delete_task_estimation(
    estimation_id: UUID,
    db: Session = Depends(get_db),
):
    service.delete_task_estimation(db, estimation_id)
