from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.modules.gantt import service
from app.modules.gantt.schema import GanttTaskCreate, GanttTaskRead, GanttTaskUpdate
from app.modules.gantt.permissions import can_manage_schedule, can_view_schedule
from app.core.dependencies import get_current_user
from app.modules.users.model import User

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
    return service.get_gantt_tasks(db, skip=skip, limit=limit)


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
    return service.get_gantt_task(db, gantt_id)


@router.post(
    "/",
    response_model=GanttTaskRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(can_manage_schedule)],
)
async def create_gantt_task(
    payload: GanttTaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.create_gantt_task(db, payload, actor=current_user)


@router.put(
    "/{gantt_id}",
    response_model=GanttTaskRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_manage_schedule)],
)
async def update_gantt_task(
    gantt_id: UUID,
    payload: GanttTaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.update_gantt_task(db, gantt_id, payload, actor=current_user)


@router.delete(
    "/{gantt_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(can_manage_schedule)],
)
async def delete_gantt_task(
    gantt_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service.delete_gantt_task(db, gantt_id, actor=current_user)
