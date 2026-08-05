from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.modules.ai.sprint_planning.model import AISprintPlan
from app.modules.ai.sprint_planning.schema import AISprintPlanCreate, AISprintPlanRead, AISprintPlanUpdate

router = APIRouter(
    prefix="/ai/sprint-plans",
    tags=["AI Sprint Plans"]
)


@router.get("/", response_model=list[AISprintPlanRead], status_code=status.HTTP_200_OK)
async def get_sprint_plans(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return db.query(AISprintPlan).offset(skip).limit(limit).all()


@router.get("/{sprint_plan_id}", response_model=AISprintPlanRead, status_code=status.HTTP_200_OK)
async def get_sprint_plan(
    sprint_plan_id: UUID,
    db: Session = Depends(get_db),
):
    sprint_plan = db.get(AISprintPlan, sprint_plan_id)
    if sprint_plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint plan not found")
    return sprint_plan


@router.post("/", response_model=AISprintPlanRead, status_code=status.HTTP_201_CREATED)
async def generate_sprint_plan(
    payload: AISprintPlanCreate,
    db: Session = Depends(get_db),
):
    sprint_plan = AISprintPlan(**payload.model_dump())
    db.add(sprint_plan)
    db.commit()
    db.refresh(sprint_plan)
    return sprint_plan


@router.put("/{sprint_plan_id}", response_model=AISprintPlanRead, status_code=status.HTTP_200_OK)
async def update_sprint_plan(
    sprint_plan_id: UUID,
    payload: AISprintPlanUpdate,
    db: Session = Depends(get_db),
):
    sprint_plan = db.get(AISprintPlan, sprint_plan_id)
    if sprint_plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint plan not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(sprint_plan, field, value)

    db.commit()
    db.refresh(sprint_plan)
    return sprint_plan


@router.delete("/{sprint_plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sprint_plan(
    sprint_plan_id: UUID,
    db: Session = Depends(get_db),
):
    sprint_plan = db.get(AISprintPlan, sprint_plan_id)
    if sprint_plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint plan not found")

    db.delete(sprint_plan)
    db.commit()
