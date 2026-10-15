from uuid import UUID

from fastapi import APIRouter, Body, Depends, status
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenException
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
from app.modules.kanban.model import KanbanColumn, KanbanTask
from app.modules.tasks import service as task_service
from app.modules.tasks.schema import TaskUpdate
from app.modules.tasks.model import Task
from app.modules.notifications.events import notify_users
from app.modules.teams.model import Team, TeamLead
from app.modules.users.model import User

router = APIRouter(
    prefix="/kanban",
    tags=["Kanban"]
)


def _is_review_column(column: KanbanColumn | None) -> bool:
    return bool(column and column.column_name.strip().upper() in {"IN REVIEW", "IN-REVIEW", "REVIEW"})


def _is_done_column(column: KanbanColumn | None) -> bool:
    return bool(column and column.column_name.strip().upper() in {"DONE", "COMPLETE", "COMPLETED"})


def _is_assigned_team_lead(db: Session, task: Task, user: User) -> bool:
    return bool(task.team_id and db.query(TeamLead.team_lead_id).join(
        Team, Team.team_lead_id == TeamLead.team_lead_id
    ).filter(Team.team_id == task.team_id, TeamLead.user_id == user.user_id).first())


def _require_review_approval(
    db: Session,
    task: Task | None,
    source_column: KanbanColumn | None,
    target_column: KanbanColumn | None,
    user: User,
) -> None:
    review_is_pending = bool(task and (task.status == "IN_REVIEW" or _is_review_column(source_column)))
    if review_is_pending and _is_done_column(target_column) and not _is_assigned_team_lead(db, task, user):
        raise ForbiddenException(message="This task is awaiting Team Lead approval. Only its assigned Team Lead can move it to Done.")

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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_kanban_columns(db, current_user, skip=skip, limit=limit)


@router.get(
    "/columns/{column_id}",
    response_model=KanbanColumnRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_board)],
)
async def get_kanban_column(
    column_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_kanban_column(db, column_id, current_user)


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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_kanban_tasks(db, current_user, skip=skip, limit=limit)


@router.get(
    "/tasks/{task_id}",
    response_model=KanbanTaskRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(can_view_board)],
)
async def get_kanban_task(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.get_kanban_task(db, task_id, current_user)


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
)
async def update_kanban_task(
    task_id: UUID,
    payload: KanbanTaskUpdate,
    current_user: User = Depends(can_move_task),
    db: Session = Depends(get_db),
):
    if payload.column_id is not None:
        placement = db.get(KanbanTask, task_id)
        task = db.get(Task, placement.task_id) if placement else None
        source_column = db.get(KanbanColumn, placement.column_id) if placement else None
        target_column = db.get(KanbanColumn, payload.column_id)
        _require_review_approval(db, task, source_column, target_column, current_user)
        if placement and payload.column_id != placement.column_id:
            return await move_kanban_task(
                task_id,
                payload.column_id,
                payload.position if payload.position is not None else placement.position,
                current_user,
                db,
            )
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
    placement_before = db.get(KanbanTask, task_id)
    previous_column_id = placement_before.column_id if placement_before else None
    previous_column = db.get(KanbanColumn, previous_column_id) if previous_column_id else None
    task = db.get(Task, placement_before.task_id) if placement_before else None
    previous_status = task.status if task else None
    target_column = db.query(KanbanColumn).filter(KanbanColumn.column_id == column_id).one_or_none()
    _require_review_approval(db, task, previous_column, target_column, current_user)
    placement = service.move_kanban_task(db, task_id, column_id, position, moved_by=current_user.user_id)
    task = db.query(Task).filter(Task.task_id == placement.task_id).one_or_none()
    column = db.query(KanbanColumn).filter(KanbanColumn.column_id == column_id).one_or_none()
    if task and column:
        column_statuses = {
            "TO DO": "TODO", "TODO": "TODO", "BACKLOG": "TODO",
            "IN PROGRESS": "IN_PROGRESS", "IN REVIEW": "IN_REVIEW", "IN-REVIEW": "IN_REVIEW", "REVIEW": "IN_REVIEW",
            "DONE": "DONE", "COMPLETE": "DONE", "COMPLETED": "DONE",
            "BLOCKED": "BLOCKED", "CANCELLED": "CANCELLED",
        }
        next_status = column_statuses.get(column.column_name.strip().upper())
        if next_status and task.status != next_status:
            task_service.update_task(
                db, task.task_id, TaskUpdate(status=next_status), assigned_by=current_user,
                send_notification=False,
            )
            task = db.get(Task, placement.task_id)
        if next_status == "DONE" and task:
            # Closing is idempotent and also repairs stale open links when a
            # task was already marked Done before its card reached this column.
            task_service.finish_task_tracking(db, task, current_user)
            db.commit()
        if previous_column_id != column_id:
            if next_status is None or next_status == previous_status:
                task_service.record_kanban_move(
                    db,
                    task,
                    current_user,
                    previous_column.column_name if previous_column else "Previous column",
                    column.column_name,
                )
            lead_ids = set()
            if task and task.team_id:
                lead_ids = {row[0] for row in db.query(TeamLead.user_id).join(
                    Team, Team.team_lead_id == TeamLead.team_lead_id
                ).filter(Team.team_id == task.team_id).all()}
            approved_by_lead = (previous_status == "IN_REVIEW" or _is_review_column(previous_column)) and next_status == "DONE" and current_user.user_id in lead_ids
            title = f"Review approved: {task.task_name}" if approved_by_lead else f"Task moved: {task.task_name}"
            message = (
                f"{current_user.name} approved your review and moved the task to Done."
                if approved_by_lead else f"{current_user.name} moved the task to {column.column_name}."
            )
            notify_users(
                db, {task.user_id} if approved_by_lead and task.user_id else lead_ids,
                actor_id=current_user.user_id, project_id=task.project_id,
                title=title, message=message,
                notification_type="Review Approved" if approved_by_lead else "Task Movement",
            )
    return placement


@router.post(
    "/tasks/{task_id}/approve-review",
    response_model=KanbanTaskRead,
    status_code=status.HTTP_200_OK,
)
async def approve_task_review(
    task_id: UUID,
    current_user: User = Depends(can_move_task),
    db: Session = Depends(get_db),
):
    """Approve a task's review and move its card to the project's Done column."""
    task = task_service.get_task(db, task_id, current_user=current_user)
    if not _is_assigned_team_lead(db, task, current_user):
        raise ForbiddenException(message="Only the assigned Team Lead can approve this task.")

    placement = db.query(KanbanTask).filter(KanbanTask.task_id == task.task_id).one_or_none()
    source_column = db.get(KanbanColumn, placement.column_id) if placement else None
    if task.status != "IN_REVIEW" and not _is_review_column(source_column):
        raise ForbiddenException(message="Only tasks in In Review can be approved.")
    if placement is None:
        raise ForbiddenException(message="This task does not have a Kanban card to approve.")

    done_column = db.query(KanbanColumn).filter(
        KanbanColumn.project_id == task.project_id,
    ).all()
    done_column = next((column for column in done_column if _is_done_column(column)), None)
    if done_column is None:
        raise ForbiddenException(message="This project's board needs a Done column before review can be approved.")

    last_position = db.query(KanbanTask.position).filter(
        KanbanTask.column_id == done_column.column_id,
    ).order_by(KanbanTask.position.desc()).first()
    position = (last_position[0] + 1) if last_position else 0
    return await move_kanban_task(
        placement.kanban_task_id,
        done_column.column_id,
        position,
        current_user,
        db,
    )


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
