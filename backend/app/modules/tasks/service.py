"""
==========================================================
                TASKS SERVICE
==========================================================

Business logic layer for Tasks. Orchestrates calls to
repository.py and translates "not found" into HTTP errors.
Routers should only ever call this layer, never the model
or repository directly.
"""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.tasks import repository
from app.modules.tasks.model import Task, TaskActivity, TaskComment, TaskSprint, TaskWorkSession, TaskWorkSessionTask
from app.modules.tasks.schema import SprintCreate, SprintUpdate, TaskCommentCreate, TaskCreate, TaskUpdate, WorkSessionStart
from app.modules.projects.model import Project
from app.modules.notifications.events import notify_project_users, project_recipient_ids, notify_users
from app.modules.users.model import User
from app.modules.kanban.model import KanbanColumn, KanbanTask
from app.modules.gantt.model import GanttTask
from app.core.permissions import has_permission
from app.core.exceptions import ForbiddenException
from app.modules.calendar.automatic import add_automatic_calendar_entries
from app.modules.calendar.model import CalendarEvent
from app.modules.teams.model import Team, TeamLead, TeamMember


def _record_activity(db: Session, task: Task, actor: User, event_type: str, details: str) -> None:
    db.add(TaskActivity(task_id=task.task_id, actor_id=actor.user_id, event_type=event_type, details=details))
    add_automatic_calendar_entries(
        db,
        project_id=task.project_id,
        actor_id=actor.user_id,
        title=f"{task.task_name}: {event_type.lower().replace('_', ' ')}",
        description=details,
        event_type="Work activity",
        personal_user_ids={actor.user_id, task.user_id} if task.user_id else {actor.user_id},
    )


def record_kanban_move(db: Session, task: Task, actor: User, from_column: str, to_column: str) -> None:
    """Record a board move when it doesn't also change the task's status."""
    _record_activity(db, task, actor, "KANBAN_MOVED", f'Moved the card from “{from_column}” to “{to_column}”.')
    db.commit()


def _sync_planning_views(db: Session, task: Task, actor_id: UUID) -> None:
    """Keep the board card and Gantt progress aligned with the task record."""
    status_column_names = {
        "TODO": "To Do", "IN_PROGRESS": "In Progress", "IN_REVIEW": "In Review",
        "DONE": "Done", "BLOCKED": "In Progress", "CANCELLED": "Done",
    }
    column_name = status_column_names.get(task.status)
    if column_name:
        column = db.query(KanbanColumn).filter(
            KanbanColumn.project_id == task.project_id,
            KanbanColumn.column_name == column_name,
        ).one_or_none()
        placement = db.query(KanbanTask).filter(KanbanTask.task_id == task.task_id).one_or_none()
        if column and placement and placement.column_id != column.column_id:
            position = db.query(KanbanTask.position).filter(KanbanTask.column_id == column.column_id).order_by(KanbanTask.position.desc()).first()
            placement.column_id = column.column_id
            placement.position = (position[0] + 1) if position else 0
            placement.moved_by = actor_id
    gantt_entry = db.query(GanttTask).filter(GanttTask.task_id == task.task_id).one_or_none()
    if gantt_entry is None and task.due_date:
        project = db.query(Project).filter(Project.project_id == task.project_id).one_or_none()
        start_date = project.start_date if project and project.start_date else task.due_date
        if start_date > task.due_date:
            start_date = task.due_date
        gantt_entry = GanttTask(
            project_id=task.project_id,
            task_id=task.task_id,
            start_date=start_date,
            end_date=task.due_date,
            progress={"TODO": 0, "IN_PROGRESS": 50, "IN_REVIEW": 75, "DONE": 100}.get(task.status, 0),
        )
        db.add(gantt_entry)
    if gantt_entry:
        gantt_entry.progress = {"TODO": 0, "IN_PROGRESS": 50, "IN_REVIEW": 75, "DONE": 100}.get(task.status, 0)
        if task.due_date:
            gantt_entry.end_date = task.due_date
            if gantt_entry.start_date > task.due_date:
                gantt_entry.start_date = task.due_date


def _is_task_in_review(db: Session, task: Task) -> bool:
    if task.status == "IN_REVIEW":
        return True
    placement = db.query(KanbanTask).filter(KanbanTask.task_id == task.task_id).one_or_none()
    column = db.get(KanbanColumn, placement.column_id) if placement else None
    return bool(column and column.column_name.strip().upper() in {"IN REVIEW", "IN-REVIEW", "REVIEW"})


def _activity_value(db: Session, field: str, value) -> str:
    if field == "user_id" and value is None:
        return "Unassigned"
    if value is None:
        return "none"
    if field == "user_id":
        user = db.query(User.name).filter(User.user_id == value).scalar()
        return user or "Unassigned"
    if field == "sprint_id":
        sprint = db.query(TaskSprint.sprint_name).filter(TaskSprint.sprint_id == value).scalar()
        return sprint or "none"
    if field == "parent_task_id":
        parent_name = db.query(Task.task_name).filter(Task.task_id == value).scalar()
        return parent_name or "none"
    return str(value)


def _checklist_activity_details(previous, current) -> str:
    """Describe individual checklist changes so the task history is readable."""
    previous_items = {
        str(item.get("item_id")): item
        for item in (previous or [])
        if isinstance(item, dict) and item.get("item_id") is not None
    }
    current_items = {
        str(item.get("item_id")): item
        for item in (current or [])
        if isinstance(item, dict) and item.get("item_id") is not None
    }
    changes = []
    for item_id in dict.fromkeys([*previous_items, *current_items]):
        old_item = previous_items.get(item_id)
        new_item = current_items.get(item_id)
        if old_item is None and new_item is not None:
            changes.append(f'Added checklist item “{new_item.get("text", "Untitled item")}”.')
        elif new_item is None and old_item is not None:
            changes.append(f'Removed checklist item “{old_item.get("text", "Untitled item")}”.')
        elif old_item is not None and new_item is not None:
            old_text = str(old_item.get("text", "Untitled item"))
            new_text = str(new_item.get("text", "Untitled item"))
            if old_text != new_text:
                changes.append(f'Renamed checklist item “{old_text}” to “{new_text}”.')
            old_completed = bool(old_item.get("is_completed", False))
            new_completed = bool(new_item.get("is_completed", False))
            if old_completed != new_completed:
                verb = "Completed" if new_completed else "Reopened"
                changes.append(f'{verb} checklist item “{new_text}”.')
    if not changes:
        return "Updated the task checklist."
    visible_changes = changes[:20]
    if len(changes) > len(visible_changes):
        visible_changes.append(f"And {len(changes) - len(visible_changes)} more checklist changes.")
    return " ".join(visible_changes)


def _validate_task_links(db: Session, project_id, parent_task_id, sprint_id, task_type, task_id=None) -> None:
    if task_type == "SUBTASK" and not parent_task_id:
        raise HTTPException(status_code=400, detail="A subtask must have a parent work item")
    if parent_task_id:
        parent = db.query(Task).filter(Task.task_id == parent_task_id).one_or_none()
        if parent is None or parent.project_id != project_id or parent.task_id == task_id:
            raise HTTPException(status_code=400, detail="Choose a parent work item from this project")
        if parent.task_type == "SUBTASK":
            raise HTTPException(status_code=400, detail="A subtask cannot be the parent of another work item")
        ancestor_id = parent.parent_task_id
        visited = {parent.task_id}
        while ancestor_id:
            if ancestor_id == task_id or ancestor_id in visited:
                raise HTTPException(status_code=400, detail="A work item cannot be its own ancestor")
            visited.add(ancestor_id)
            ancestor = db.query(Task.parent_task_id).filter(Task.task_id == ancestor_id).scalar()
            ancestor_id = ancestor
    if sprint_id:
        sprint = db.query(TaskSprint).filter(TaskSprint.sprint_id == sprint_id).one_or_none()
        existing_task = db.query(Task).filter(Task.task_id == task_id).one_or_none() if task_id else None
        is_existing_assignment = existing_task is not None and existing_task.sprint_id == sprint_id
        if sprint is None or sprint.project_id != project_id or (sprint.status == "COMPLETED" and not is_existing_assignment):
            raise HTTPException(status_code=400, detail="Choose an open sprint from this project")


def _validate_team_lead_assignee(db: Session, project_id, actor: User, assignee_id) -> None:
    if assignee_id is None or has_permission(db, actor, "roles.manage"):
        return
    if db.query(Project.project_id).filter(
        Project.project_id == project_id, Project.project_manager_user_id == actor.user_id
    ).first():
        return
    lead_ids = db.query(TeamLead.team_lead_id).filter(TeamLead.user_id == actor.user_id).subquery()
    team_ids = {row[0] for row in db.query(Team.team_id).filter(
        Team.project_id == project_id, Team.team_lead_id.in_(lead_ids)
    ).all()}
    if not team_ids:
        return
    eligible_ids = {row[0] for row in db.query(TeamMember.user_id).filter(TeamMember.team_id.in_(team_ids)).all()}
    eligible_ids.update(row[0] for row in db.query(TeamLead.user_id).filter(TeamLead.team_lead_id.in_(
        db.query(Team.team_lead_id).filter(Team.team_id.in_(team_ids))
    )).all())
    if assignee_id not in eligible_ids:
        raise HTTPException(status_code=400, detail="Team leads can assign tasks only to members of their project team")


def _validate_team_assignment(db: Session, project_id, actor: User, team_id, assignee_id, task_id=None) -> None:
    if team_id is None:
        return
    team = db.query(Team).filter(
        Team.team_id == team_id,
        Team.project_id == project_id,
        Team.organization_id == actor.organization_id,
    ).one_or_none()
    if team is None:
        raise HTTPException(status_code=400, detail="Choose a team from this project")
    is_team_lead = db.query(TeamLead.team_lead_id).filter(
        TeamLead.team_lead_id == team.team_lead_id,
        TeamLead.user_id == actor.user_id,
    ).first() is not None
    is_project_manager = db.query(Project.project_id).filter(
        Project.project_id == project_id,
        Project.project_manager_user_id == actor.user_id,
    ).first() is not None
    if not (is_team_lead or is_project_manager or has_permission(db, actor, "roles.manage")):
        raise HTTPException(status_code=404, detail="Team not found")
    if assignee_id is None:
        raise HTTPException(status_code=400, detail="Assign the task to a member of the selected team")
    is_member = db.query(TeamMember.member_id).filter(
        TeamMember.team_id == team_id,
        TeamMember.user_id == assignee_id,
    ).first() is not None
    if not is_member:
        raise HTTPException(status_code=400, detail="Choose a member of the selected team")
    active_tasks = db.query(Task.task_id).filter(
        Task.project_id == project_id,
        Task.user_id == assignee_id,
        Task.status.notin_(("DONE", "CANCELLED")),
    )
    if task_id is not None:
        active_tasks = active_tasks.filter(Task.task_id != task_id)
    if active_tasks.first() is not None:
        raise HTTPException(status_code=409, detail="This member already has unfinished work in this project")


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


def _task_team_lead_ids(db: Session, task: Task) -> set[UUID]:
    if not task.team_id:
        return set()
    rows = db.query(TeamLead.user_id).join(Team, Team.team_lead_id == TeamLead.team_lead_id).filter(
        Team.team_id == task.team_id,
    ).all()
    return {row[0] for row in rows}


def get_tasks(
    db: Session,
    current_user: User,
    skip: int = 0,
    limit: int = 100,
) -> list[Task]:
    """Return all tasks to management; others see their team projects and assignments."""
    if has_permission(db, current_user, "roles.manage"):
        return repository.get_tasks(db, skip=skip, limit=limit)
    if has_permission(db, current_user, "projects.manage"):
        project_ids = {row[0] for row in db.query(Project.project_id).filter(Project.project_manager_user_id == current_user.user_id).all()}
        lead_ids = db.query(TeamLead.team_lead_id).filter(TeamLead.user_id == current_user.user_id).subquery()
        project_ids.update(row[0] for row in db.query(Team.project_id).filter(Team.team_lead_id.in_(lead_ids)).all())
        if not project_ids:
            return []
        return repository.get_tasks_by_project_ids(db, project_ids, skip=skip, limit=limit)
    owned_project_ids = {row[0] for row in db.query(Project.project_id).filter(
        Project.project_manager_user_id == current_user.user_id
    ).all()}
    if owned_project_ids:
        return repository.get_tasks_by_project_ids(db, owned_project_ids, skip=skip, limit=limit)
    project_ids = repository.get_visible_project_ids(db, current_user.user_id)
    lead_ids = db.query(TeamLead.team_lead_id).filter(TeamLead.user_id == current_user.user_id).subquery()
    lead_project_ids = {row[0] for row in db.query(Team.project_id).filter(Team.team_lead_id.in_(lead_ids)).all()}
    if lead_project_ids:
        return repository.get_tasks_by_project_ids(db, lead_project_ids, skip=skip, limit=limit)
    if has_permission(db, current_user, "tasks.view") and has_permission(db, current_user, "tasks.manage"):
        return repository.get_tasks_by_project_ids(db, project_ids, skip=skip, limit=limit)
    return db.query(Task).filter(Task.user_id == current_user.user_id).order_by(Task.created_at.desc()).offset(skip).limit(limit).all()


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
    if current_user and not has_permission(db, current_user, "roles.manage"):
        # A general task-view or project-manage grant is not workspace-wide
        # data access. Project managers are scoped to projects assigned to
        # them, while contributors retain their team/project visibility.
        if has_permission(db, current_user, "projects.manage"):
            project_ids = {
                row[0] for row in db.query(Project.project_id).filter(
                    Project.project_manager_user_id == current_user.user_id
                ).all()
            }
            lead_ids = db.query(TeamLead.team_lead_id).filter(TeamLead.user_id == current_user.user_id).subquery()
            project_ids.update(row[0] for row in db.query(Team.project_id).filter(Team.team_lead_id.in_(lead_ids)).all())
        else:
            project_ids = {row[0] for row in db.query(Project.project_id).filter(
                Project.project_manager_user_id == current_user.user_id
            ).all()}
            lead_ids = db.query(TeamLead.team_lead_id).filter(TeamLead.user_id == current_user.user_id).subquery()
            lead_project_ids = {row[0] for row in db.query(Team.project_id).filter(Team.team_lead_id.in_(lead_ids)).all()}
            project_ids.update(lead_project_ids)
            if task.user_id == current_user.user_id:
                project_ids.add(task.project_id)
        is_assigned = (
            task.user_id == current_user.user_id
            and has_permission(db, current_user, "tasks.update_assigned")
        )
        if task.project_id not in project_ids and (
            has_permission(db, current_user, "projects.manage") or not is_assigned
        ):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


def create_task(
    db: Session,
    payload: TaskCreate,
    assigned_by: User,
) -> Task:
    """Create a task and notify its project team and assignee."""
    if not has_permission(db, assigned_by, "projects.manage"):
        visible_project_ids = repository.get_visible_project_ids(db, assigned_by.user_id)
        if payload.project_id not in visible_project_ids:
            raise HTTPException(status_code=404, detail="Project not found")
    _validate_team_lead_assignee(db, payload.project_id, assigned_by, payload.user_id)
    _validate_team_assignment(db, payload.project_id, assigned_by, payload.team_id, payload.user_id)
    try:
        _validate_task_links(db, payload.project_id, payload.parent_task_id, payload.sprint_id, payload.task_type)
        task = repository.create_task(db, payload, commit=False)
        # Keep the task table and board in sync for tasks created outside the board UI.
        status_column_names = {
            "TODO": "To Do", "IN_PROGRESS": "In Progress", "IN_REVIEW": "In Review",
            "DONE": "Done", "BLOCKED": "In Progress", "CANCELLED": "Done",
        }
        column = None
        if payload.kanban_column_id:
            column = db.query(KanbanColumn).filter(
                KanbanColumn.column_id == payload.kanban_column_id,
                KanbanColumn.project_id == task.project_id,
            ).one_or_none()
            if column is None:
                raise HTTPException(status_code=400, detail="Choose a board column from this project")
        if column is None:
            column = db.query(KanbanColumn).filter(
                KanbanColumn.project_id == task.project_id,
                KanbanColumn.column_name == status_column_names.get(task.status, "To Do"),
            ).one_or_none()
        if column is None:
            column = db.query(KanbanColumn).filter(
                KanbanColumn.project_id == task.project_id
            ).order_by(KanbanColumn.position.asc()).first()
        if column is not None:
            position = (db.query(KanbanTask.position).filter(KanbanTask.column_id == column.column_id)
                        .order_by(KanbanTask.position.desc()).first())
            db.add(KanbanTask(
                task_id=task.task_id,
                column_id=column.column_id,
                position=payload.kanban_position if payload.kanban_position is not None else ((position[0] + 1) if position else 0),
                moved_by=assigned_by.user_id,
            ))
        if task.due_date:
            project = db.query(Project).filter(Project.project_id == task.project_id).one_or_none()
            start_date = project.start_date if project and project.start_date else task.due_date
            if start_date > task.due_date:
                start_date = task.due_date
            progress = {"TODO": 0, "IN_PROGRESS": 50, "IN_REVIEW": 75, "DONE": 100}.get(task.status, 0)
            db.add(GanttTask(
                project_id=task.project_id,
                task_id=task.task_id,
                start_date=start_date,
                end_date=task.due_date,
                progress=progress,
            ))
            add_automatic_calendar_entries(
                db,
                project_id=task.project_id,
                actor_id=assigned_by.user_id,
                title=f"Task deadline: {task.task_name}",
                description=f"Due date for task assigned to {task.assignee.name if task.assignee else 'the project team'}.",
                event_type="Deadline",
                personal_user_ids={task.user_id or assigned_by.user_id},
                event_date=task.due_date,
                related_task_id=task.task_id,
            )
        _record_activity(db, task, assigned_by, "CREATED", f"Created {task.task_type.lower()} “{task.task_name}”.")
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
    send_notification: bool = True,
) -> Task:
    """Update a task and notify a newly assigned user atomically."""
    current_task = get_task(db, task_id)
    review_is_pending = _is_task_in_review(db, current_task)
    changes_review_status = review_is_pending and payload.status is not None and payload.status != current_task.status
    review_approval_pending = review_is_pending and payload.status == "DONE"
    is_assigned_lead = changes_review_status and current_task.team_id is not None and db.query(TeamLead.team_lead_id).join(
            Team, Team.team_lead_id == TeamLead.team_lead_id
        ).filter(Team.team_id == current_task.team_id, TeamLead.user_id == assigned_by.user_id).first() is not None
    if changes_review_status and not is_assigned_lead:
        raise ForbiddenException(message="This task is awaiting review. Only its assigned Team Lead can change its status.")
    if "user_id" in payload.model_fields_set:
        _validate_team_lead_assignee(db, current_task.project_id, assigned_by, payload.user_id)
        _validate_team_assignment(db, current_task.project_id, assigned_by, current_task.team_id, payload.user_id, task_id=current_task.task_id)
    previous_assignee_id = current_task.user_id
    previous_status = current_task.status
    assignment_was_sent = "user_id" in payload.model_fields_set
    previous_values = {key: getattr(current_task, key, None) for key in payload.model_fields_set}
    _validate_task_links(
        db,
        current_task.project_id,
        payload.parent_task_id if "parent_task_id" in payload.model_fields_set else current_task.parent_task_id,
        payload.sprint_id if "sprint_id" in payload.model_fields_set else current_task.sprint_id,
        payload.task_type if "task_type" in payload.model_fields_set else current_task.task_type,
        task_id=current_task.task_id,
    )
    try:
        task = repository.update_task(db, task_id, payload, commit=False)
        if task is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found",
            )
        _sync_planning_views(db, task, assigned_by.user_id)
        if task.status == "DONE" and previous_status != "DONE":
            finish_task_tracking(db, task, assigned_by)
        if {"due_date", "user_id"} & payload.model_fields_set:
            db.query(CalendarEvent).filter(
                CalendarEvent.related_task_id == task.task_id,
                CalendarEvent.is_automatic.is_(True),
            ).delete(synchronize_session=False)
            if task.due_date:
                add_automatic_calendar_entries(
                    db,
                    project_id=task.project_id,
                    actor_id=assigned_by.user_id,
                    title=f"Task deadline: {task.task_name}",
                    description=f"Current due date for {task.task_name}.",
                    event_type="Deadline",
                    personal_user_ids={task.user_id or assigned_by.user_id},
                    event_date=task.due_date,
                    related_task_id=task.task_id,
                )
        for field, previous in previous_values.items():
            current = getattr(task, field, None)
            if current != previous:
                if field == "checklist_items":
                    _record_activity(db, task, assigned_by, "CHECKLIST_UPDATED", _checklist_activity_details(previous, current))
                    continue
                previous_label = _activity_value(db, field, previous)
                current_label = _activity_value(db, field, current)
                _record_activity(db, task, assigned_by, "UPDATED", f"Changed {field.replace('_', ' ')} from {previous_label} to {current_label}.")
        assignment_changed = assignment_was_sent and task.user_id != previous_assignee_id
        db.commit()
        db.refresh(task)
        if review_approval_pending and task.status == "DONE" and is_assigned_lead and send_notification:
            notify_users(
                db, {task.user_id} if task.user_id else set(), actor_id=assigned_by.user_id,
                project_id=task.project_id,
                title=f"Review approved: {task.task_name}",
                message=f"{assigned_by.name} approved your task review. The task is now Done.",
                notification_type="Review Approved",
            )
        elif assignment_changed and send_notification:
            _notify_assignee(db, task, assigned_by)
        elif send_notification:
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
    add_automatic_calendar_entries(
        db,
        project_id=project_id,
        actor_id=deleted_by.user_id,
        title=f"Task deleted: {task_name}",
        description=f"{deleted_by.name} deleted this task.",
        event_type="Work activity",
        personal_user_ids={deleted_by.user_id, assignee_id} if assignee_id else {deleted_by.user_id},
    )
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
    project_ids = (
        repository.get_visible_project_ids(db, current_user.user_id)
        if has_permission(db, current_user, "tasks.team_view")
        else set()
    )
    if has_permission(db, current_user, "tasks.team_view") and parent.project_id in project_ids:
        return repository.get_subtasks(db, task_id)
    return repository.get_visible_subtasks(db, task_id, current_user.user_id, project_ids)


def get_comments(db: Session, task_id: UUID, current_user: User) -> list[TaskComment]:
    get_task(db, task_id, current_user=current_user)
    return db.query(TaskComment).filter(TaskComment.task_id == task_id).order_by(TaskComment.created_at.asc()).all()


def add_comment(db: Session, task_id: UUID, payload: TaskCommentCreate, current_user: User) -> TaskComment:
    task = get_task(db, task_id, current_user=current_user)
    if not has_permission(db, current_user, "tasks.manage") and not (
        task.user_id == current_user.user_id and has_permission(db, current_user, "tasks.update_assigned")
    ):
        raise ForbiddenException(message="You may comment only on tasks assigned to you")
    comment = TaskComment(task_id=task_id, author_id=current_user.user_id, content=payload.content.strip())
    db.add(comment)
    _record_activity(db, task, current_user, "COMMENTED", f"Added a comment: {payload.content.strip()[:180]}")
    db.commit()
    db.refresh(comment)
    notify_project_users(
        db, task.project_id, actor_id=current_user.user_id,
        additional_user_ids={task.user_id} if task.user_id else set(),
        title=f"New comment: {task.task_name}", message=f"{current_user.name} commented on a task.",
        notification_type="Task Comment",
    )
    return comment


def get_activity(db: Session, task_id: UUID, current_user: User) -> list[TaskActivity]:
    get_task(db, task_id, current_user=current_user)
    return db.query(TaskActivity).filter(TaskActivity.task_id == task_id).order_by(TaskActivity.created_at.desc()).all()


def _work_session_read(
    session: TaskWorkSession,
    visible_project_ids: set[UUID] | None = None,
) -> dict:
    now = datetime.now(timezone.utc)
    elapsed = max(0, int(((session.ended_at or now) - session.started_at).total_seconds()))
    links = [
        link for link in session.task_links
        if (visible_project_ids is None or (link.task and link.task.project_id in visible_project_ids))
        and (session.ended_at is not None or (link.ended_at is None and link.task and link.task.status != "DONE"))
    ]
    return {
        "work_session_id": session.work_session_id,
        "user_id": session.user_id,
        "user_name": session.user.name if session.user else "Former member",
        "started_at": session.started_at,
        "ended_at": session.ended_at,
        "duration_seconds": session.duration_seconds if session.ended_at else elapsed,
        "is_running": session.ended_at is None,
        "task_ids": [link.task_id for link in links],
        "task_names": [link.task.task_name for link in links if link.task],
    }


def _can_view_project_work_times(db: Session, current_user: User) -> bool:
    """Whether the user can see team/project timers instead of only their own."""
    if any(has_permission(db, current_user, code) for code in ("roles.manage", "projects.manage")):
        return True
    if db.query(Project.project_id).filter(Project.project_manager_user_id == current_user.user_id).first():
        return True
    return db.query(TeamLead.team_lead_id).filter(TeamLead.user_id == current_user.user_id).first() is not None


def get_work_sessions(db: Session, current_user: User, limit: int = 100) -> list[dict]:
    query = db.query(TaskWorkSession).filter(TaskWorkSession.organization_id == current_user.organization_id)
    visible_project_ids = None
    if not has_permission(db, current_user, "roles.manage"):
        # Keep manager privileges additive to team-lead/member visibility.
        # Restricting this to manager-owned projects hid a selected lead's
        # active timers when that lead also had project-management actions.
        visible_project_ids = repository.get_visible_project_ids(db, current_user.user_id)
        if not visible_project_ids:
            return []
        visible_sessions = db.query(TaskWorkSessionTask.work_session_id).join(
            Task, Task.task_id == TaskWorkSessionTask.task_id
        ).filter(Task.project_id.in_(visible_project_ids))
        query = query.filter(TaskWorkSession.work_session_id.in_(visible_sessions))
        if not _can_view_project_work_times(db, current_user):
            query = query.filter(TaskWorkSession.user_id == current_user.user_id)
    sessions = query.order_by(TaskWorkSession.started_at.desc()).limit(min(limit, 500)).all()
    return [_work_session_read(session, visible_project_ids) for session in sessions]


def get_task_work_times(db: Session, current_user: User) -> list[dict]:
    query = db.query(TaskWorkSessionTask).join(TaskWorkSession).join(Task).filter(
        TaskWorkSessionTask.organization_id == current_user.organization_id,
    )
    if not has_permission(db, current_user, "roles.manage"):
        # Match the selected team-lead/member scope used by the Kanban board,
        # even when this user also has project-management permissions.
        project_ids = repository.get_visible_project_ids(db, current_user.user_id)
        if not project_ids:
            return []
        query = query.filter(Task.project_id.in_(project_ids))
        if not _can_view_project_work_times(db, current_user):
            query = query.filter(Task.user_id == current_user.user_id)
    links = query.all()
    _reconcile_completed_task_links(db, links)
    totals: dict[UUID, dict] = {}
    for link in links:
        item = totals.setdefault(link.task_id, {"task_id": link.task_id, "duration_seconds": 0, "is_tracking": False, "active_since": None})
        if link.ended_at is not None:
            item["duration_seconds"] += link.duration_seconds
        else:
            item["is_tracking"] = True
            item["active_since"] = link.linked_at.isoformat()
    return list(totals.values())


def _reconcile_completed_task_links(db: Session, links: list[TaskWorkSessionTask]) -> None:
    """Freeze active timers when either the task or its board placement is Done."""
    active_task_ids = {link.task_id for link in links if link.ended_at is None}
    done_column_moves = {}
    if active_task_ids:
        done_column_moves = dict(db.query(KanbanTask.task_id, KanbanTask.moved_at).join(
            KanbanColumn, KanbanColumn.column_id == KanbanTask.column_id
        ).filter(
            KanbanTask.task_id.in_(active_task_ids),
            func.upper(func.trim(KanbanColumn.column_name)).in_(("DONE", "COMPLETE", "COMPLETED")),
        ).all())

    now = datetime.now(timezone.utc)
    sessions: dict[UUID, TaskWorkSession] = {}
    for link in links:
        if link.ended_at is not None or not link.task:
            continue
        board_move_at = done_column_moves.get(link.task_id)
        if link.task.status != "DONE" and board_move_at is None:
            continue

        linked_at = link.linked_at
        if linked_at.tzinfo is None:
            linked_at = linked_at.replace(tzinfo=timezone.utc)
        ended_at = board_move_at or link.task.updated_at or now
        if ended_at.tzinfo is None:
            ended_at = ended_at.replace(tzinfo=timezone.utc)
        # Older placements may have their creation time in moved_at. If it
        # predates this timer link, stop the stale timer at reconciliation.
        if ended_at < linked_at:
            ended_at = now
        link.ended_at = ended_at
        link.duration_seconds += max(0, int((link.ended_at - linked_at).total_seconds()))
        sessions[link.session.work_session_id] = link.session
    if not sessions:
        return
    db.flush()
    for session in sessions.values():
        if session.ended_at is None and not any(link.ended_at is None for link in session.task_links):
            session.ended_at = max((link.ended_at for link in session.task_links if link.ended_at), default=now)
            session.duration_seconds = max(0, int((session.ended_at - session.started_at).total_seconds()))
    db.commit()


def finish_task_tracking(db: Session, task: Task, actor: User) -> None:
    """Stop this task's timer links, even if their shared session is stale."""
    now = datetime.now(timezone.utc)
    active_links = db.query(TaskWorkSessionTask).filter(
        TaskWorkSessionTask.task_id == task.task_id,
        TaskWorkSessionTask.organization_id == task.organization_id,
        TaskWorkSessionTask.ended_at.is_(None),
    ).all()
    closed_sessions: dict[UUID, TaskWorkSession] = {}
    for link in active_links:
        link.ended_at = now
        link.duration_seconds += max(0, int((now - link.linked_at).total_seconds()))
        session = link.session
        if session and session.ended_at is None:
            closed_sessions[session.work_session_id] = session
        _record_activity(db, task, actor, "TIME_LOGGED", f"Task completed; its shared timer stopped at {link.duration_seconds} seconds.")
    db.flush()
    for session in closed_sessions.values():
        if not any(link.ended_at is None for link in session.task_links):
            session.ended_at = now
            session.duration_seconds = max(0, int((now - session.started_at).total_seconds()))


def start_work_session(db: Session, payload: WorkSessionStart, current_user: User) -> dict:
    if not any(has_permission(db, current_user, code) for code in ("tasks.update_assigned", "tasks.manage", "kanban.move")):
        raise ForbiddenException(message="Your role does not allow starting task work")
    task_ids = list(dict.fromkeys(payload.task_ids))
    tasks = db.query(Task).filter(
        Task.task_id.in_(task_ids), Task.organization_id == current_user.organization_id,
    ).all()
    if len(tasks) != len(task_ids):
        raise HTTPException(status_code=404, detail="One or more tasks were not found")
    if any(task.user_id != current_user.user_id for task in tasks):
        raise ForbiddenException(message="You can only start work assigned to you")
    done_column_task_ids = set(db.query(KanbanTask.task_id).join(
        KanbanColumn, KanbanColumn.column_id == KanbanTask.column_id
    ).filter(
        KanbanTask.task_id.in_(task_ids),
        func.upper(func.trim(KanbanColumn.column_name)).in_(("DONE", "COMPLETE", "COMPLETED")),
    ).all())
    done_column_task_ids = {task_id for (task_id,) in done_column_task_ids}
    if any(task.status in {"DONE", "CANCELLED"} or task.task_id in done_column_task_ids for task in tasks):
        raise HTTPException(status_code=409, detail="Completed or cancelled work cannot be started")
    session = db.query(TaskWorkSession).filter(
        TaskWorkSession.user_id == current_user.user_id,
        TaskWorkSession.organization_id == current_user.organization_id,
        TaskWorkSession.ended_at.is_(None),
    ).with_for_update().one_or_none()
    if session is None:
        session = TaskWorkSession(user_id=current_user.user_id, organization_id=current_user.organization_id)
        db.add(session)
        db.flush()
    existing_links = {link.task_id: link for link in session.task_links}
    now = datetime.now(timezone.utc)
    started_tasks = []
    for task in tasks:
        link = existing_links.get(task.task_id)
        if link is None:
            session.task_links.append(TaskWorkSessionTask(task_id=task.task_id, organization_id=current_user.organization_id, linked_at=now))
            _record_activity(db, task, current_user, "TIMER_LINKED", f"Added this task to shared work session {session.work_session_id}.")
        elif link.ended_at is not None:
            link.linked_at = now
            link.ended_at = None
            _record_activity(db, task, current_user, "TIMER_LINKED", f"Resumed tracking this task in shared work session {session.work_session_id}.")
        if task.status != "IN_PROGRESS":
            task.status = "IN_PROGRESS"
            _sync_planning_views(db, task, current_user.user_id)
            _record_activity(db, task, current_user, "STARTED", f"Started work in shared session {session.work_session_id}.")
            started_tasks.append(task)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="A work timer is already running. Refresh and add this task to it.") from error
    db.refresh(session)
    for task in started_tasks:
        notify_users(
            db, _task_team_lead_ids(db, task), actor_id=current_user.user_id,
            project_id=task.project_id, title=f"Work started: {task.task_name}",
            message=f"{current_user.name} started this task.", notification_type="Task Movement",
        )
    return _work_session_read(session)


def stop_work_session(db: Session, current_user: User) -> dict:
    session = db.query(TaskWorkSession).filter(
        TaskWorkSession.user_id == current_user.user_id,
        TaskWorkSession.organization_id == current_user.organization_id,
        TaskWorkSession.ended_at.is_(None),
    ).with_for_update().one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="There is no running work timer")
    now = datetime.now(timezone.utc)
    session.ended_at = now
    session.duration_seconds = max(0, int((now - session.started_at).total_seconds()))
    for link in session.task_links:
        if link.ended_at is None:
            link.ended_at = now
            link.duration_seconds += max(0, int((now - link.linked_at).total_seconds()))
            if link.task:
                _record_activity(db, link.task, current_user, "TIME_LOGGED", f"Shared timer stopped at {link.duration_seconds} seconds for this task; session time is counted once overall.")
    db.commit()
    db.refresh(session)
    return _work_session_read(session)


def get_sprints(db: Session, project_id: UUID, current_user: User) -> list[TaskSprint]:
    if db.query(Project.project_id).filter(Project.project_id == project_id).first() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if not has_permission(db, current_user, "tasks.manage"):
        visible_project_ids = repository.get_visible_project_ids(db, current_user.user_id)
        if project_id not in visible_project_ids:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return db.query(TaskSprint).filter(TaskSprint.project_id == project_id).order_by(TaskSprint.created_at.desc()).all()


def create_sprint(db: Session, payload: SprintCreate, current_user: User) -> TaskSprint:
    if payload.start_date and payload.end_date and payload.end_date < payload.start_date:
        raise HTTPException(status_code=400, detail="Sprint end date must be on or after its start date")
    sprint = TaskSprint(**payload.model_dump(), created_by=current_user.user_id)
    db.add(sprint)
    db.commit()
    db.refresh(sprint)
    add_automatic_calendar_entries(
        db, project_id=sprint.project_id, actor_id=current_user.user_id,
        title=f"Sprint planned: {sprint.sprint_name}",
        description=f"{current_user.name} planned a project sprint.", event_type="Planning",
        personal_user_ids=project_recipient_ids(db, sprint.project_id) | {current_user.user_id},
        event_date=sprint.start_date,
    )
    db.commit()
    notify_project_users(db, sprint.project_id, actor_id=current_user.user_id,
        title=f"Sprint planned: {sprint.sprint_name}", message=f"{current_user.name} planned a project sprint.",
        notification_type="Sprint Created")
    return sprint


def update_sprint(db: Session, sprint_id: UUID, payload: SprintUpdate, current_user: User) -> TaskSprint:
    sprint = db.query(TaskSprint).filter(TaskSprint.sprint_id == sprint_id).one_or_none()
    if sprint is None:
        raise HTTPException(status_code=404, detail="Sprint not found")
    values = payload.model_dump(exclude_unset=True)
    start = values.get("start_date", sprint.start_date)
    end = values.get("end_date", sprint.end_date)
    if start and end and end < start:
        raise HTTPException(status_code=400, detail="Sprint end date must be on or after its start date")
    if values.get("status") == "ACTIVE":
        active_sprint = db.query(TaskSprint).filter(
            TaskSprint.project_id == sprint.project_id,
            TaskSprint.status == "ACTIVE",
            TaskSprint.sprint_id != sprint.sprint_id,
        ).first()
        if active_sprint:
            raise HTTPException(status_code=409, detail=f"Finish “{active_sprint.sprint_name}” before starting another sprint")
    for key, value in values.items():
        setattr(sprint, key, value)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Another sprint is already active for this project") from error
    db.refresh(sprint)
    add_automatic_calendar_entries(
        db, project_id=sprint.project_id, actor_id=current_user.user_id,
        title=f"Sprint updated: {sprint.sprint_name}",
        description=f"{current_user.name} updated sprint details or status.", event_type="Work activity",
        personal_user_ids=project_recipient_ids(db, sprint.project_id) | {current_user.user_id},
        event_date=sprint.start_date,
    )
    db.commit()
    notify_project_users(db, sprint.project_id, actor_id=current_user.user_id,
        title=f"Sprint updated: {sprint.sprint_name}", message=f"{current_user.name} updated sprint details or status.",
        notification_type="Sprint Updated")
    return sprint
