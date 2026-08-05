from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.modules.kanban.model import KanbanColumn, KanbanTask
from app.modules.kanban.schema import (
    KanbanColumnCreate,
    KanbanColumnRead,
    KanbanColumnUpdate,
    KanbanTaskCreate,
    KanbanTaskRead,
    KanbanTaskUpdate,
)

router = APIRouter(
    prefix="/kanban",
    tags=["Kanban"]
)

# ==========================================================
# Kanban Columns
# ==========================================================

@router.get("/columns", response_model=list[KanbanColumnRead], status_code=status.HTTP_200_OK)
async def get_kanban_columns(
    db: Session = Depends(get_db),
):
    return db.query(KanbanColumn).all()


@router.get("/columns/{column_id}", response_model=KanbanColumnRead, status_code=status.HTTP_200_OK)
async def get_kanban_column(
    column_id: UUID,
    db: Session = Depends(get_db),
):
    column = db.get(KanbanColumn, column_id)
    if column is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanban column not found")
    return column


@router.post("/columns", response_model=KanbanColumnRead, status_code=status.HTTP_201_CREATED)
async def create_kanban_column(
    payload: KanbanColumnCreate,
    db: Session = Depends(get_db),
):
    column = KanbanColumn(**payload.model_dump())
    db.add(column)
    db.commit()
    db.refresh(column)
    return column


@router.put("/columns/{column_id}", response_model=KanbanColumnRead, status_code=status.HTTP_200_OK)
async def update_kanban_column(
    column_id: UUID,
    payload: KanbanColumnUpdate,
    db: Session = Depends(get_db),
):
    column = db.get(KanbanColumn, column_id)
    if column is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanban column not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(column, field, value)

    db.commit()
    db.refresh(column)
    return column


@router.delete("/columns/{column_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_kanban_column(
    column_id: UUID,
    db: Session = Depends(get_db),
):
    column = db.get(KanbanColumn, column_id)
    if column is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanban column not found")

    db.delete(column)
    db.commit()


# ==========================================================
# Kanban Tasks
# ==========================================================

@router.get("/tasks", response_model=list[KanbanTaskRead], status_code=status.HTTP_200_OK)
async def get_kanban_tasks(
    db: Session = Depends(get_db),
):
    return db.query(KanbanTask).all()


@router.get("/tasks/{task_id}", response_model=KanbanTaskRead, status_code=status.HTTP_200_OK)
async def get_kanban_task(
    task_id: UUID,
    db: Session = Depends(get_db),
):
    kanban_task = db.get(KanbanTask, task_id)
    if kanban_task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanban task not found")
    return kanban_task


@router.post("/tasks", response_model=KanbanTaskRead, status_code=status.HTTP_201_CREATED)
async def create_kanban_task(
    payload: KanbanTaskCreate,
    db: Session = Depends(get_db),
):
    kanban_task = KanbanTask(**payload.model_dump())
    db.add(kanban_task)
    db.commit()
    db.refresh(kanban_task)
    return kanban_task


@router.put("/tasks/{task_id}", response_model=KanbanTaskRead, status_code=status.HTTP_200_OK)
async def update_kanban_task(
    task_id: UUID,
    payload: KanbanTaskUpdate,
    db: Session = Depends(get_db),
):
    kanban_task = db.get(KanbanTask, task_id)
    if kanban_task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanban task not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(kanban_task, field, value)

    db.commit()
    db.refresh(kanban_task)
    return kanban_task


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_kanban_task(
    task_id: UUID,
    db: Session = Depends(get_db),
):
    kanban_task = db.get(KanbanTask, task_id)
    if kanban_task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanban task not found")

    db.delete(kanban_task)
    db.commit()
