from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.modules.gantt.model import GanttTask
from app.modules.gantt.schema import GanttTaskCreate, GanttTaskRead, GanttTaskUpdate
from app.modules.gantt.permissions import can_manage_schedule, can_view_schedule

router = APIRouter(
    prefix="/gantt/tasks",
    tags=["Gantt"]
)


@router.get(
    "/",
    response_model=list[GanttTaskRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_schedule)],
)
async def get_gantt_tasks(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return db.query(GanttTask).offset(skip).limit(limit).all()


@router.get(
    "/{gantt_id}",
    response_model=GanttTaskRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_schedule)],
)
async def get_gantt_task(
    gantt_id: UUID,
    db: Session = Depends(get_db),
):
    gantt_task = db.get(GanttTask, gantt_id)
    if gantt_task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gantt task not found")
    return gantt_task


@router.post(
    "/",
    response_model=GanttTaskRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(can_manage_schedule)],
)
async def create_gantt_task(
    payload: GanttTaskCreate,
    db: Session = Depends(get_db),
):
    gantt_task = GanttTask(**payload.model_dump())
    db.add(gantt_task)
    db.commit()
    db.refresh(gantt_task)
    return gantt_task


@router.put(
    "/{gantt_id}",
    response_model=GanttTaskRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_manage_schedule)],
)
async def update_gantt_task(
    gantt_id: UUID,
    payload: GanttTaskUpdate,
    db: Session = Depends(get_db),
):
    gantt_task = db.get(GanttTask, gantt_id)
    if gantt_task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gantt task not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(gantt_task, field, value)

    db.commit()
    db.refresh(gantt_task)
    return gantt_task


@router.delete(
    "/{gantt_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(can_manage_schedule)],
)
async def delete_gantt_task(
    gantt_id: UUID,
    db: Session = Depends(get_db),
):
    gantt_task = db.get(GanttTask, gantt_id)
    if gantt_task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gantt task not found")

    db.delete(gantt_task)
    db.commit()