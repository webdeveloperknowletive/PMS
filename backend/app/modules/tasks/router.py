from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.modules.tasks import service
from app.modules.tasks.schema import TaskCreate, TaskRead, TaskUpdate
from app.modules.tasks.permissions import can_manage_tasks, can_update_task, can_view_tasks
from app.modules.users.model import User

router = APIRouter(
    prefix="/tasks",
    tags=["Tasks"]
)


@router.get(
    "/",
    response_model=list[TaskRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_tasks)],
)
async def get_tasks(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return service.get_tasks(db, skip=skip, limit=limit)


@router.get(
    "/{task_id}",
    response_model=TaskRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_tasks)],
)
async def get_task(
    task_id: UUID,
    db: Session = Depends(get_db),
):
    return service.get_task(db, task_id)


@router.post(
    "/",
    response_model=TaskRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(can_manage_tasks)],
)
async def create_task(
    payload: TaskCreate,
    db: Session = Depends(get_db),
):
    return service.create_task(db, payload)


@router.put("/{task_id}", response_model=TaskRead, status_code=status.HTTP_200_OK)
async def update_task(
    task_id: UUID,
    payload: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Fetched via the service layer (raises 404 if missing) so we know who
    # this task is assigned to — a static Depends() can't see that, so the
    # ownership check has to happen here, after the fetch.
    task = service.get_task(db, task_id)
    can_update_task(task_assignee_id=task.user_id, current_user=current_user, db=db)

    return service.update_task(db, task_id, payload)


@router.delete(
    "/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(can_manage_tasks)],
)
async def delete_task(
    task_id: UUID,
    db: Session = Depends(get_db),
):
    service.delete_task(db, task_id)


@router.get(
    "/{task_id}/subtasks",
    response_model=list[TaskRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_tasks)],
)
async def get_subtasks(
    task_id: UUID,
    db: Session = Depends(get_db),
):
    return service.get_subtasks(db, task_id)
