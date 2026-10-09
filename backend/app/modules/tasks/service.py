"""
==========================================================
                TASKS SERVICE
==========================================================

Business logic layer for Tasks. Orchestrates calls to
repository.py and translates "not found" into HTTP errors.
Routers should only ever call this layer, never the model
or repository directly.
"""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.tasks import repository
from app.modules.tasks.model import Task
from app.modules.tasks.schema import TaskCreate, TaskUpdate
from app.modules.notifications.events import notify_project_users
from app.modules.users.model import User
from app.core.permissions import has_permission


def _notify_assignee(db: Session, task: Task, assigned_by: User) -> None:
    notify_project_users(
        db,
        task.project_id,
        actor_id=assigned_by.user_id,
        additional_user_ids={task.user_id} if task.user_id else set(),
        title=f"Task assigned: {task.task_name}",
        message=f"{assigned_by.name} assigned this task to {task.assignee.name if task.assignee else 'a teammate'}.",
        notification_type="Task Assignment",
    )


def get_tasks(
    db: Session,
    current_user: User,
    skip: int = 0,
    limit: int = 100,
) -> list[Task]:
    """Return all tasks to management; others see their team projects and assignments."""
    if has_permission(db, current_user, "tasks.manage"):
        return repository.get_tasks(db, skip=skip, limit=limit)
    project_ids = repository.get_visible_project_ids(db, current_user.user_id)
    return repository.get_tasks_for_user(
        db,
        user_id=current_user.user_id,
        project_ids=project_ids,
        skip=skip,
        limit=limit,
    )


def get_task(
    db: Session,
    task_id: UUID,
    current_user: User | None = None,
) -> Task:
    """Get a single task by ID, or raise 404."""
    task = repository.get_task(db, task_id)
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
    if current_user and not has_permission(db, current_user, "tasks.manage"):
        project_ids = repository.get_visible_project_ids(db, current_user.user_id)
        if not repository.task_is_visible_to_user(db, task, current_user.user_id, project_ids):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


def create_task(
    db: Session,
    payload: TaskCreate,
    assigned_by: User,
) -> Task:
    """Create a task and notify its project team and assignee."""
    try:
        task = repository.create_task(db, payload, commit=False)
        db.commit()
        db.refresh(task)
        assignee_name = task.assignee.name if task.assignee else None
        notify_project_users(
            db, task.project_id, actor_id=assigned_by.user_id,
            additional_user_ids={task.user_id} if task.user_id else set(),
            title=f"New task: {task.task_name}",
            message=f"{assigned_by.name} created this task" + (f" and assigned it to {assignee_name}." if assignee_name else "."),
            notification_type="Task Created",
        )
        return task
    except Exception:
        db.rollback()
        raise


def update_task(
    db: Session,
    task_id: UUID,
    payload: TaskUpdate,
    assigned_by: User,
) -> Task:
    """Update a task and notify a newly assigned user atomically."""
    current_task = get_task(db, task_id)
    previous_assignee_id = current_task.user_id
    assignment_was_sent = "user_id" in payload.model_fields_set
    try:
        task = repository.update_task(db, task_id, payload, commit=False)
        if task is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found",
            )
        assignment_changed = assignment_was_sent and task.user_id != previous_assignee_id
        db.commit()
        db.refresh(task)
        if assignment_changed:
            _notify_assignee(db, task, assigned_by)
        else:
            notify_project_users(
                db, task.project_id, actor_id=assigned_by.user_id,
                additional_user_ids={task.user_id} if task.user_id else set(),
                title=f"Task updated: {task.task_name}",
                message=f"{assigned_by.name} updated this task.",
                notification_type="Task Updated",
            )
        return task
    except Exception:
        db.rollback()
        raise


def delete_task(
    db: Session,
    task_id: UUID,
    deleted_by: User,
) -> None:
    """Delete a task, or raise 404."""
    task = get_task(db, task_id)
    project_id, task_name, assignee_id = task.project_id, task.task_name, task.user_id
    deleted = repository.delete_task(db, task_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
    notify_project_users(
        db, project_id, actor_id=deleted_by.user_id,
        additional_user_ids={assignee_id} if assignee_id else set(),
        title=f"Task deleted: {task_name}",
        message=f"{deleted_by.name} deleted this task.",
        notification_type="Task Deleted",
    )


def get_subtasks(
    db: Session,
    task_id: UUID,
    current_user: User,
) -> list[Task]:
    """Get all subtasks of a parent task, or raise 404 if the parent doesn't exist."""
    parent = get_task(db, task_id, current_user=current_user)
    if has_permission(db, current_user, "tasks.manage"):
        return repository.get_subtasks(db, task_id)
    project_ids = repository.get_visible_project_ids(db, current_user.user_id)
    if parent.project_id in project_ids:
        return repository.get_subtasks(db, task_id)
    return repository.get_visible_subtasks(db, task_id, current_user.user_id, project_ids)
