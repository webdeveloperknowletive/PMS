from uuid import UUID

from fastapi import APIRouter, Body, Depends, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.modules.kanban import service
from app.modules.kanban.schema import (
    KanbanColumnCreate,
    KanbanColumnRead,
    KanbanColumnUpdate,
    KanbanTaskCreate,
    KanbanTaskRead,
    KanbanTaskUpdate,
)
from app.modules.kanban.permissions import can_manage_board, can_move_task, can_view_board
from app.modules.users.model import User

router = APIRouter(
    prefix="/kanban",
    tags=["Kanban"]
)

# ==========================================================
# Kanban Columns
# ==========================================================

@router.get(
    "/columns",
    response_model=list[KanbanColumnRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_board)],
)
async def get_kanban_columns(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return service.get_kanban_columns(db, skip=skip, limit=limit)


@router.get(
    "/columns/{column_id}",
    response_model=KanbanColumnRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_board)],
)
async def get_kanban_column(
    column_id: UUID,
    db: Session = Depends(get_db),
):
    return service.get_kanban_column(db, column_id)


@router.post(
    "/columns",
    response_model=KanbanColumnRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(can_manage_board)],
)
async def create_kanban_column(
    payload: KanbanColumnCreate,
    db: Session = Depends(get_db),
):
    return service.create_kanban_column(db, payload)


@router.put(
    "/columns/{column_id}",
    response_model=KanbanColumnRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_manage_board)],
)
async def update_kanban_column(
    column_id: UUID,
    payload: KanbanColumnUpdate,
    db: Session = Depends(get_db),
):
    return service.update_kanban_column(db, column_id, payload)


@router.delete(
    "/columns/{column_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(can_manage_board)],
)
async def delete_kanban_column(
    column_id: UUID,
    db: Session = Depends(get_db),
):
    service.delete_kanban_column(db, column_id)


# ==========================================================
# Kanban Tasks (card placements)
# ==========================================================

@router.get(
    "/tasks",
    response_model=list[KanbanTaskRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_board)],
)
async def get_kanban_tasks(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return service.get_kanban_tasks(db, skip=skip, limit=limit)


@router.get(
    "/tasks/{task_id}",
    response_model=KanbanTaskRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_board)],
)
async def get_kanban_task(
    task_id: UUID,
    db: Session = Depends(get_db),
):
    return service.get_kanban_task(db, task_id)


@router.post(
    "/tasks",
    response_model=KanbanTaskRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(can_manage_board)],
)
async def create_kanban_task(
    payload: KanbanTaskCreate,
    db: Session = Depends(get_db),
):
    return service.create_kanban_task(db, payload)


@router.put(
    "/tasks/{task_id}",
    response_model=KanbanTaskRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_move_task)],
)
async def update_kanban_task(
    task_id: UUID,
    payload: KanbanTaskUpdate,
    db: Session = Depends(get_db),
):
    return service.update_kanban_task(db, task_id, payload)


@router.patch(
    "/tasks/{task_id}/move",
    response_model=KanbanTaskRead,
    status_code=status.HTTP_200_OK,
)
async def move_kanban_task(
    task_id: UUID,
    column_id: UUID = Body(...),
    position: int = Body(...),
    current_user: User = Depends(can_move_task),
    db: Session = Depends(get_db),
):
    """
    The actual drag-and-drop endpoint: moves a card to a new column/position
    and stamps who moved it (from the authenticated user, not the request
    body, so this can't be spoofed).
    """
    return service.move_kanban_task(db, task_id, column_id, position, moved_by=current_user.user_id)


@router.delete(
    "/tasks/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(can_manage_board)],
)
async def delete_kanban_task(
    task_id: UUID,
    db: Session = Depends(get_db),
):
    service.delete_kanban_task(db, task_id)
