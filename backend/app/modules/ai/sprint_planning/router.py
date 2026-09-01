from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.modules.ai.sprint_planning import service
from app.modules.ai.sprint_planning.schema import AISprintPlanCreate, AISprintPlanRead, AISprintPlanUpdate
from app.modules.ai.sprint_planning.permissions import can_generate, can_view_results

router = APIRouter(
    prefix="/ai/sprint-plans",
    tags=["AI Sprint Plans"]
)


@router.get(
    "/",
    response_model=list[AISprintPlanRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_results)],
)
async def get_sprint_plans(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return service.get_sprint_plans(db, skip=skip, limit=limit)


@router.get(
    "/{sprint_plan_id}",
    response_model=AISprintPlanRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_results)],
)
async def get_sprint_plan(
    sprint_plan_id: UUID,
    db: Session = Depends(get_db),
):
    return service.get_sprint_plan(db, sprint_plan_id)


@router.post(
    "/",
    response_model=AISprintPlanRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(can_generate)],
)
async def generate_sprint_plan(
    payload: AISprintPlanCreate,
    db: Session = Depends(get_db),
):
    return service.generate_sprint_plan(db, payload)


@router.put(
    "/{sprint_plan_id}",
    response_model=AISprintPlanRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_generate)],
)
async def update_sprint_plan(
    sprint_plan_id: UUID,
    payload: AISprintPlanUpdate,
    db: Session = Depends(get_db),
):
    return service.update_sprint_plan(db, sprint_plan_id, payload)


@router.delete(
    "/{sprint_plan_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(can_generate)],
)
async def delete_sprint_plan(
    sprint_plan_id: UUID,
    db: Session = Depends(get_db),
):
    service.delete_sprint_plan(db, sprint_plan_id)
