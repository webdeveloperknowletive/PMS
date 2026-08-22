from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.modules.tasks.model import Task
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
    return db.query(Task).offset(skip).limit(limit).all()


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
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


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
    task = Task(**payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.put("/{task_id}", response_model=TaskRead, status_code=status.HTTP_200_OK)
async def update_task(
    task_id: UUID,
    payload: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    # Ownership check happens here, not in `dependencies=`, because we only
    # know who this task is assigned to (task.user_id) after fetching it —
    # a static Depends() can't see that.
    can_update_task(task_assignee_id=task.user_id, current_user=current_user, db=db)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)
    return task


@router.delete(
    "/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(can_manage_tasks)],
)
async def delete_task(
    task_id: UUID,
    db: Session = Depends(get_db),
):
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    db.delete(task)
    db.commit()


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
    parent = db.get(Task, task_id)
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return db.query(Task).filter(Task.parent_task_id == task_id).all()