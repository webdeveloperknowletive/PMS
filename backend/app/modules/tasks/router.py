from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.modules.tasks.model import Task
from app.modules.tasks.schema import TaskCreate, TaskRead, TaskUpdate

router = APIRouter(
    prefix="/tasks",
    tags=["Tasks"]
)


@router.get("/", response_model=list[TaskRead], status_code=status.HTTP_200_OK)
async def get_tasks(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return db.query(Task).offset(skip).limit(limit).all()


@router.get("/{task_id}", response_model=TaskRead, status_code=status.HTTP_200_OK)
async def get_task(
    task_id: UUID,
    db: Session = Depends(get_db),
):
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


@router.post("/", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
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
    db: Session = Depends(get_db),
):
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: UUID,
    db: Session = Depends(get_db),
):
    task = db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    db.delete(task)
    db.commit()


@router.get("/{task_id}/subtasks", response_model=list[TaskRead], status_code=status.HTTP_200_OK)
async def get_subtasks(
    task_id: UUID,
    db: Session = Depends(get_db),
):
    parent = db.get(Task, task_id)
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return db.query(Task).filter(Task.parent_task_id == task_id).all()
