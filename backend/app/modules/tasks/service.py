"""
==========================================================
                TASKS SERVICE
==========================================================

Business logic layer for Tasks. Orchestrates calls to
repository.py and translates "not found" into HTTP errors.
Routers should only ever call this layer, never the model
or repository directly.
"""

from datetime import date, datetime, time, timedelta, timezone
from statistics import median
from uuid import UUID

from sqlalchemy import and_, func, or_
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased

from app.modules.tasks import repository
from app.modules.tasks.model import Task, TaskActivity, TaskComment, TaskLink, TaskReminderDelivery, TaskSprint, TaskSprintScopeChange, TaskStatusHistory, TaskWorkSession, TaskWorkSessionTask
from app.modules.tasks.schema import BlockedTaskRead, BlockedTasksSummaryRead, SprintBurndownPointRead, SprintCreate, SprintReportRead, SprintUpdate, SprintVelocityRead, TaskBulkUpdate, TaskChecklistMemberOptionRead, TaskChecklistItem, TaskCommentCreate, TaskCreate, TaskDependencyListRead, TaskUpdate, TaskStatusHistoryRead, WorkSessionStart
from app.modules.projects.model import Project, ProjectComponent, ProjectCustomField
from app.modules.projects.model import ProjectGoal
from app.modules.projects.model import ProjectRelease
from app.modules.projects.release_scope import record_release_scope_change
from app.modules.workflow.model import Workflow
from app.modules.projects.custom_field_schema import _validate_value as _validate_custom_field_value
from app.modules.notifications.events import notify_project_users, project_recipient_ids, notify_users
from app.modules.notifications.model import Notification
from app.modules.users.model import User
from app.modules.kanban.model import KanbanCardMember, KanbanColumn, KanbanLabel, KanbanTask
from app.modules.gantt.model import GanttTask
from app.core.permissions import has_permission
from app.core.exceptions import ForbiddenException
from app.modules.calendar.automatic import add_automatic_calendar_entries
from app.modules.calendar.model import CalendarEvent
from app.modules.teams.model import Team, TeamLead, TeamMember
from app.modules.roles.model import Role, UserRole
from app.modules.tasks.schema import TaskAssigneeCandidateRead


_ALLOWED_TASK_TRANSITIONS = {
    "TODO": {"IN_PROGRESS", "BLOCKED", "CANCELLED"},
    "IN_PROGRESS": {"TODO", "IN_REVIEW", "BLOCKED", "DONE", "CANCELLED"},
    "IN_REVIEW": {"IN_PROGRESS", "BLOCKED", "DONE"},
    "BLOCKED": {"TODO", "IN_PROGRESS", "CANCELLED"},
    "DONE": {"IN_PROGRESS"},
    "CANCELLED": {"TODO"},
}

_REMINDER_TEXT = {
    0: "on the due date",
    1: "1 day before the due date",
    2: "2 days before the due date",
    7: "1 week before the due date",
}


def deliver_task_deadline_reminders(db: Session, current_user: User, local_date: date) -> int:
    """Create today's in-app task reminders once for the signed-in assignee/member.

    The app calls this while the user is signed in. The delivery table makes
    concurrent tabs/devices idempotent; no pending job needs cancellation when
    a task is completed, archived, deleted, or rescheduled.
    """
    utc_date = datetime.now(timezone.utc).date()
    if abs((local_date - utc_date).days) > 1:
        raise HTTPException(status_code=400, detail="Reminder check date must match the user's current local date")
    if not current_user.is_active:
        return 0

    assigned_card_task_ids = db.query(KanbanCardMember.task_id).filter(
        KanbanCardMember.user_id == current_user.user_id,
        KanbanCardMember.organization_id == current_user.organization_id,
    )
    tasks = db.query(Task).filter(
        Task.organization_id == current_user.organization_id,
        Task.archived_at.is_(None),
        Task.status.notin__(("DONE", "CANCELLED")),
        Task.due_date >= local_date,
        Task.due_date <= local_date + timedelta(days=7),
        Task.reminder_days_before.is_not(None),
        ((Task.user_id == current_user.user_id) | Task.task_id.in_(assigned_card_task_ids)),
    ).all()

    created = 0
    try:
        for task in tasks:
            reminder_days = task.reminder_days_before
            if reminder_days not in _REMINDER_TEXT or task.due_date - timedelta(days=reminder_days) > local_date:
                continue
            delivery = TaskReminderDelivery(
                organization_id=current_user.organization_id,
                task_id=task.task_id,
                user_id=current_user.user_id,
                due_date=task.due_date,
                reminder_days_before=reminder_days,
            )
            try:
                with db.begin_nested():
                    db.add(delivery)
                    db.flush()
            except IntegrityError:
                # Another tab/device already delivered this task/date/offset.
                continue

            days_left = (task.due_date - local_date).days
            deadline = task.due_date.strftime("%B %d, %Y").replace(" 0", " ")
            title = "Task due today" if days_left == 0 else f"Task due in {days_left} day{'s' if days_left != 1 else ''}"
            db.add(Notification(
                organization_id=current_user.organization_id,
                user_id=current_user.user_id,
                project_id=task.project_id,
                title=f"{title}: {task.task_name}"[:255],
                message=f"Your task is due {deadline}. Reminder set for {_REMINDER_TEXT[reminder_days]}.",
                notification_type="Task Deadline Reminder",
                is_read=False,
            ))
            created += 1
        if created:
            db.commit()
        else:
            db.rollback()
    except Exception:
        db.rollback()
        raise
    return created


def get_project_assignee_candidates(db: Session, project_id: UUID, current_user: User) -> list[TaskAssigneeCandidateRead]:
    """Return active workspace Developers/Testers; restrict team leads to their project teams."""
    from app.modules.projects.service import get_project

    project = get_project(db, project_id, current_user)
    is_project_manager = project.project_manager_user_id == current_user.user_id
    lead_ids = None if is_project_manager or has_permission(db, current_user, "roles.manage") else db.query(
        TeamLead.team_lead_id
    ).filter(TeamLead.user_id == current_user.user_id).subquery()
    query = db.query(User, Team.team_id, Team.team_name, Role.role_name).join(
        TeamMember, TeamMember.user_id == User.user_id,
    ) if lead_ids is not None else db.query(User, Team.team_id, Team.team_name, Role.role_name).outerjoin(
        TeamMember,
        and_(TeamMember.user_id == User.user_id, TeamMember.organization_id == User.organization_id),
    )
    query = query.outerjoin(
        Team,
        and_(
            Team.team_id == TeamMember.team_id,
            Team.project_id == project_id,
            Team.organization_id == current_user.organization_id,
        ),
    ).join(
        UserRole, UserRole.user_id == User.user_id,
    ).join(
        Role, Role.role_id == UserRole.role_id,
    ).filter(
        User.organization_id == current_user.organization_id,
        User.is_active.is_(True),
        func.lower(Role.role_name).in_(("developer", "tester")),
    )
    if lead_ids is not None:
        query = query.filter(
            Team.project_id == project_id,
            Team.organization_id == current_user.organization_id,
            Team.team_lead_id.in_(lead_ids),
        )
    rows = query.order_by(User.name.asc(), Role.role_name.asc(), Team.created_at.asc().nulls_last()).all()

    candidates_by_user = {}
    for user, team_id, team_name, role_name in rows:
        candidate = candidates_by_user.get(user.user_id)
        if candidate is None:
            candidate = {
                "user_id": user.user_id,
                "name": user.name,
                "team_id": team_id,
                "team_name": team_name,
                "role_names": set(),
            }
            candidates_by_user[user.user_id] = candidate
        candidate["role_names"].add(role_name)

    return [
        TaskAssigneeCandidateRead(
            user_id=candidate["user_id"],
            name=candidate["name"],
            role_name=" / ".join(sorted(candidate["role_names"])),
            team_id=candidate["team_id"],
            team_name=candidate["team_name"],
        )
        for candidate in candidates_by_user.values()
    ]


def get_checklist_member_options(db: Session, project_id: UUID, current_user: User) -> list[TaskChecklistMemberOptionRead]:
    """Return active members of active teams in a visible project."""
    from app.modules.projects.service import get_project

    get_project(db, project_id, current_user)
    rows = db.query(User.user_id, User.name).join(
        TeamMember, TeamMember.user_id == User.user_id,
    ).join(
        Team, Team.team_id == TeamMember.team_id,
    ).filter(
        Team.project_id == project_id,
        Team.organization_id == current_user.organization_id,
        Team.status == "ACTIVE",
        User.organization_id == current_user.organization_id,
        User.is_active.is_(True),
    ).distinct().order_by(User.name.asc()).all()
    return [TaskChecklistMemberOptionRead(user_id=user_id, name=name) for user_id, name in rows]


def get_checklist_task(db: Session, task_id: UUID, current_user: User) -> Task:
    """Allow checklist-authorized project members to act within their visible project."""
    task = repository.get_task(db, task_id)
    if task is None or task.organization_id != current_user.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if task.user_id == current_user.user_id and has_permission(db, current_user, "tasks.update_assigned"):
        return task
    from app.modules.projects.service import get_project

    get_project(db, task.project_id, current_user)
    return task


def _prepare_checklist_items(db: Session, project_id: UUID, organization_id: UUID, previous_items: list[dict], items: list[TaskChecklistItem], actor: User) -> list[TaskChecklistItem]:
    """Enforce advanced checklist permission, preserve legacy fields, and validate assigned members."""
    can_manage_details = has_permission(db, actor, "kanban.card_checklists.items.manage")
    previous_by_id = {
        str(item.get("item_id")): item
        for item in (previous_items or [])
        if isinstance(item, dict) and item.get("item_id") is not None
    }
    eligible_members: set[UUID] = set()
    validated_items: list[TaskChecklistItem] = []
    for item in items:
        previous = previous_by_id.get(item.item_id, {})
        fields_set = item.model_fields_set
        requested_assignee = item.assignee_user_id if "assignee_user_id" in fields_set else previous.get("assignee_user_id")
        requested_due_date = item.due_date if "due_date" in fields_set else previous.get("due_date")
        previous_assignee = previous.get("assignee_user_id")
        previous_due_date = previous.get("due_date")

        if not can_manage_details:
            if "assignee_user_id" in fields_set and str(requested_assignee or "") != str(previous_assignee or ""):
                raise ForbiddenException(message="Missing required permission: kanban.card_checklists.items.manage")
            if "due_date" in fields_set and _checklist_date_value(requested_due_date) != _checklist_date_value(previous_due_date):
                raise ForbiddenException(message="Missing required permission: kanban.card_checklists.items.manage")
            requested_assignee = previous_assignee
            requested_due_date = previous_due_date

        assignee_id = UUID(str(requested_assignee)) if requested_assignee else None
        assignee_name = None
        if assignee_id is not None:
            if not can_manage_details or str(assignee_id) == str(previous_assignee or ""):
                # Existing assignments survive basic checklist edits, including when the project member later becomes inactive.
                assignee_name = previous.get("assignee_name")
            else:
                if not eligible_members:
                    eligible_members = {row[0] for row in db.query(TeamMember.user_id).join(
                        Team, Team.team_id == TeamMember.team_id,
                    ).join(
                        User, User.user_id == TeamMember.user_id,
                    ).filter(
                        Team.project_id == project_id,
                        Team.organization_id == organization_id,
                        Team.status == "ACTIVE",
                        User.organization_id == organization_id,
                        User.is_active.is_(True),
                    ).distinct().all()}
                if assignee_id not in eligible_members:
                    raise HTTPException(status_code=400, detail="Choose an active member of this project's teams")
                assignee_name = db.query(User.name).filter(
                    User.user_id == assignee_id,
                    User.organization_id == organization_id,
                    User.is_active.is_(True),
                ).scalar()

        try:
            due_date = date.fromisoformat(requested_due_date) if isinstance(requested_due_date, str) and requested_due_date else requested_due_date
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Checklist item due date must be a valid date") from exc
        if isinstance(due_date, str):
            raise HTTPException(status_code=400, detail="Checklist item due date must be a valid date")
        validated_items.append(item.model_copy(update={
            "assignee_user_id": assignee_id,
            "assignee_name": assignee_name,
            "due_date": due_date,
        }))
    return validated_items


def _checklist_date_value(value):
    if isinstance(value, date):
        return value.isoformat()
    return str(value) if value else ""


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


def _record_status_transition(db: Session, task: Task, actor: User, previous_status: str, next_status: str) -> None:
    if previous_status == next_status:
        return
    db.add(TaskStatusHistory(
        organization_id=task.organization_id,
        task_id=task.task_id,
        task_name=task.task_name,
        actor_id=actor.user_id,
        from_status=previous_status,
        to_status=next_status,
    ))
    previous_label = previous_status.replace("_", " ").title()
    next_label = next_status.replace("_", " ").title()
    _record_activity(db, task, actor, "STATUS_CHANGED", f"Changed status from {previous_label} to {next_label}.")


def _validate_task_transition(
    previous_status: str,
    next_status: str,
    *,
    can_manage: bool,
    review_pending: bool,
    assigned_reviewer: bool,
    allowed_transitions: dict[str, set[str]] | None = None,
) -> None:
    if previous_status == next_status:
        return
    transitions = allowed_transitions or _ALLOWED_TASK_TRANSITIONS
    if review_pending:
        if not assigned_reviewer:
            raise ForbiddenException(message="This task is awaiting review. Only its assigned Team Lead or Project Manager can change its status.")
        if next_status not in {"IN_PROGRESS", "BLOCKED", "DONE"}:
            raise ForbiddenException(message="A Team Lead or Project Manager must return a review task to In Progress, mark it Blocked, or approve it to Done.")
        if next_status not in transitions.get(previous_status, set()):
            raise ForbiddenException(message=f"This task cannot move from {previous_status.replace('_', ' ').title()} to {next_status.replace('_', ' ').title()} in the active project workflow.")
        return
    if not can_manage and next_status not in transitions.get(previous_status, set()):
        raise ForbiddenException(message=f"This task cannot move from {previous_status.replace('_', ' ').title()} to {next_status.replace('_', ' ').title()}.")


def _project_task_transitions(db: Session, task: Task) -> dict[str, set[str]]:
    """Use the active default workflow for the task's project, with a legacy-safe fallback."""
    workflow = db.query(Workflow.allowed_transitions).filter(
        Workflow.organization_id == task.organization_id,
        Workflow.project_id == task.project_id,
        Workflow.is_default.is_(True),
        Workflow.status == "ACTIVE",
    ).order_by(Workflow.created_at, Workflow.workflow_id).first()
    if workflow is None or not isinstance(workflow[0], dict):
        return _ALLOWED_TASK_TRANSITIONS
    configured = workflow[0]
    return {
        source: set(configured.get(source, []))
        for source in _ALLOWED_TASK_TRANSITIONS
    }


def _record_sprint_scope_change(
    db: Session,
    *,
    sprint_id: UUID,
    task: Task,
    actor: User | None,
    event_type: str,
    points_before: int | None,
    points_after: int | None,
    occurred_at: datetime | None = None,
) -> None:
    change = TaskSprintScopeChange(
        organization_id=task.organization_id,
        sprint_id=sprint_id,
        task_id=task.task_id,
        task_name=task.task_name,
        actor_id=actor.user_id if actor else None,
        event_type=event_type,
        points_before=points_before,
        points_after=points_after,
    )
    if occurred_at is not None:
        change.created_at = occurred_at
    db.add(change)


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
        start_date = task.start_date or (project.start_date if project and project.start_date else task.due_date)
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
        if task.start_date is not None:
            gantt_entry.start_date = task.start_date
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


def _validate_goal_link(db: Session, project_id: UUID, goal_id: UUID | None) -> None:
    if goal_id is None:
        return
    goal = db.query(ProjectGoal.goal_id).filter(
        ProjectGoal.goal_id == goal_id,
        ProjectGoal.project_id == project_id,
    ).one_or_none()
    if goal is None:
        raise HTTPException(status_code=400, detail="Choose a goal from this project")


def _validate_release_link(db: Session, project_id: UUID, release_id: UUID | None) -> None:
    if release_id is None:
        return
    release = db.query(ProjectRelease.release_id).filter(
        ProjectRelease.release_id == release_id,
        ProjectRelease.project_id == project_id,
    ).one_or_none()
    if release is None:
        raise HTTPException(status_code=400, detail="Choose a release from this project")


def _validate_component_link(db: Session, project_id: UUID, component_id: UUID | None, actor: User) -> None:
    if component_id is None:
        return
    component = db.query(ProjectComponent.component_id).filter(
        ProjectComponent.component_id == component_id,
        ProjectComponent.project_id == project_id,
        ProjectComponent.organization_id == actor.organization_id,
    ).one_or_none()
    if component is None:
        raise HTTPException(status_code=400, detail="Choose a component from this project")


def _validate_task_due_date(db: Session, project_id: UUID, due_date: date | None, organization_id: UUID) -> None:
    if due_date is None:
        return
    project_dates = db.query(Project.start_date).filter(
        Project.project_id == project_id,
        Project.organization_id == organization_id,
    ).one_or_none()
    if project_dates is None:
        raise HTTPException(status_code=404, detail="Project not found")
    start_date = project_dates[0]
    if start_date is not None and due_date < start_date:
        raise HTTPException(status_code=400, detail="Task due date must be on or after the project start date")


def _validate_task_date_range(start_date: date | None, due_date: date | None) -> None:
    if start_date and due_date and due_date < start_date:
        raise HTTPException(status_code=400, detail="Task due date must be on or after its start date")


def _validate_task_custom_fields(
    db: Session,
    project_id: UUID,
    organization_id: UUID,
    provided: dict | None,
    *,
    existing: dict | None = None,
) -> dict:
    definitions = db.query(ProjectCustomField).filter(
        ProjectCustomField.project_id == project_id,
        ProjectCustomField.organization_id == organization_id,
    ).all()
    by_id = {str(field.field_id): field for field in definitions}
    incoming = provided or {}
    unknown = set(incoming) - set(by_id)
    if unknown:
        raise HTTPException(status_code=400, detail="Remove custom field values that are not defined for this project")

    values = dict(existing or {}) if provided is not None else {}
    for key, field in by_id.items():
        if key not in values and field.default_value is not None:
            values[key] = field.default_value
    for key, raw_value in incoming.items():
        field = by_id[key]
        if raw_value is None or (isinstance(raw_value, str) and not raw_value.strip()):
            values.pop(key, None)
            continue
        try:
            value = _validate_custom_field_value(field.field_type, raw_value, field.options or [], field.name)
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
        if value is None or (field.field_type == "TEXT" and value == ""):
            values.pop(key, None)
        else:
            values[key] = value

    for key, field in by_id.items():
        value = values.get(key)
        is_empty = value is None or (field.field_type == "TEXT" and value == "")
        if field.is_required and (is_empty or (field.field_type == "CHECKBOX" and value is not True)):
            raise HTTPException(status_code=400, detail=f"{field.name} is required")
    return values


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
    if field == "release_id":
        release_name = db.query(ProjectRelease.name).filter(ProjectRelease.release_id == value).scalar()
        return release_name or "none"
    if field == "component_id":
        component_name = db.query(ProjectComponent.name).filter(ProjectComponent.component_id == value).scalar()
        return component_name or "none"
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
            new_text = str(new_item.get("text", "Untitled item"))
            changes.append(f'Added checklist item “{new_text}”.')
            if new_item.get("assignee_user_id"):
                changes.append(f'Assigned checklist item “{new_text}” to {new_item.get("assignee_name") or "a project team member"}.')
            new_due_date = _checklist_date_value(new_item.get("due_date"))
            if new_due_date:
                changes.append(f'Set the due date for “{new_text}” to {new_due_date}.')
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
            old_assignee = str(old_item.get("assignee_user_id") or "")
            new_assignee = str(new_item.get("assignee_user_id") or "")
            if old_assignee != new_assignee:
                assignee_name = new_item.get("assignee_name") or "Unassigned"
                changes.append(f'Changed the responsible member for “{new_text}” to {assignee_name}.')
            old_due_date = _checklist_date_value(old_item.get("due_date"))
            new_due_date = _checklist_date_value(new_item.get("due_date"))
            if old_due_date != new_due_date:
                changes.append(f'Changed the due date for “{new_text}” to {new_due_date or "none"}.')
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
    if assignee_id is None:
        return
    active_assignee = db.query(User.user_id).filter(
        User.user_id == assignee_id,
        User.organization_id == actor.organization_id,
        User.is_active.is_(True),
    ).one_or_none()
    if active_assignee is None:
        raise HTTPException(status_code=400, detail="Choose an active user in this workspace")
    if has_permission(db, actor, "roles.manage"):
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


def _visible_tasks_query(db: Session, current_user: User):
    """Build the same tenant and project scope used by task list reads."""
    query = db.query(Task).filter(Task.organization_id == current_user.organization_id)
    if has_permission(db, current_user, "roles.manage"):
        pass
    elif has_permission(db, current_user, "projects.manage"):
        project_ids = {row[0] for row in db.query(Project.project_id).filter(Project.project_manager_user_id == current_user.user_id).all()}
        lead_ids = db.query(TeamLead.team_lead_id).filter(TeamLead.user_id == current_user.user_id).subquery()
        project_ids.update(row[0] for row in db.query(Team.project_id).filter(Team.team_lead_id.in_(lead_ids)).all())
        if not project_ids:
            return query.filter(False)
        query = query.filter(Task.project_id.in_(project_ids))
    else:
        owned_project_ids = {row[0] for row in db.query(Project.project_id).filter(
            Project.project_manager_user_id == current_user.user_id
        ).all()}
        if owned_project_ids:
            query = query.filter(Task.project_id.in_(owned_project_ids))
        else:
            project_ids = repository.get_visible_project_ids(db, current_user.user_id)
            lead_ids = db.query(TeamLead.team_lead_id).filter(TeamLead.user_id == current_user.user_id).subquery()
            lead_project_ids = {row[0] for row in db.query(Team.project_id).filter(Team.team_lead_id.in_(lead_ids)).all()}
            if lead_project_ids:
                query = query.filter(Task.project_id.in_(lead_project_ids))
            elif has_permission(db, current_user, "tasks.view") and has_permission(db, current_user, "tasks.manage"):
                query = query.filter(Task.project_id.in_(project_ids)) if project_ids else query.filter(False)
            else:
                query = query.filter(Task.user_id == current_user.user_id)
    return query


def get_tasks(
    db: Session,
    current_user: User,
    skip: int = 0,
    limit: int = 100,
    search: str | None = None,
    project_id: UUID | None = None,
    assignee_id: UUID | None = None,
    task_status: str | None = None,
    priority: str | None = None,
    component_id: UUID | None = None,
    release_id: UUID | None = None,
    label: str | None = None,
    overdue: bool = False,
    due_after: date | None = None,
    due_before: date | None = None,
    backlog: bool = False,
    blocked: bool = False,
) -> list[Task]:
    """Return tasks in the current workspace and user's project scope."""
    query = _visible_tasks_query(db, current_user)

    tasks = repository.list_filtered_tasks(
        query,
        db=db,
        skip=skip,
        limit=limit,
        search=search,
        project_id=project_id,
        assignee_id=assignee_id,
        task_status=task_status,
        priority=priority,
        component_id=component_id,
        release_id=release_id,
        label=label,
        overdue=overdue,
        due_after=due_after,
        due_before=due_before,
        backlog=backlog,
        blocked=blocked,
    )
    if tasks:
        feedback_rows = db.query(TaskActivity.task_id, TaskActivity.details).filter(
            TaskActivity.organization_id == current_user.organization_id,
            TaskActivity.task_id.in_([task.task_id for task in tasks]),
            TaskActivity.event_type.in_(("REVIEW_CHANGES_REQUESTED", "REVIEW_SUBMITTED", "REVIEW_APPROVED")),
        ).order_by(TaskActivity.created_at.asc()).all()
        feedback_by_task = {}
        for task_id, details in feedback_rows:
            feedback_by_task[task_id] = details.removeprefix("PM requested changes: ") if details.startswith("PM requested changes: ") else None
        for task in tasks:
            task.review_feedback = feedback_by_task.get(task.task_id)
    return tasks


def _task_dependency_query(db: Session, current_user: User):
    visible_task_ids = _visible_tasks_query(db, current_user).with_entities(Task.task_id).subquery()
    source = aliased(Task)
    target = aliased(Task)
    owner = aliased(User)
    query = db.query(
        TaskLink.link_id, source.project_id, Project.project_name,
        source.task_id, source.task_name, target.task_id, target.task_name,
        target.due_date, TaskLink.owner_id, owner.name,
    ).join(
        source, TaskLink.source_task_id == source.task_id,
    ).join(
        target, TaskLink.target_task_id == target.task_id,
    ).join(
        Project, Project.project_id == target.project_id,
    ).outerjoin(
        owner, (TaskLink.owner_id == owner.user_id) & (owner.organization_id == current_user.organization_id),
    ).filter(
        TaskLink.organization_id == current_user.organization_id,
        TaskLink.link_type == "BLOCKS",
        source.task_id.in_(visible_task_ids),
        target.task_id.in_(visible_task_ids),
        source.status.notin_(("DONE", "CANCELLED")),
        target.status.notin_(("DONE", "CANCELLED")),
    )
    return query, source, target


def get_task_dependencies(
    db: Session,
    current_user: User,
    *,
    skip: int = 0,
    limit: int = 50,
    project_id: UUID | None = None,
    owner_id: UUID | None = None,
    unassigned: bool = False,
    overdue: bool = False,
    search: str | None = None,
) -> TaskDependencyListRead:
    query, source, target = _task_dependency_query(db, current_user)
    if project_id:
        query = query.filter(source.project_id == project_id)
    if owner_id:
        query = query.filter(TaskLink.owner_id == owner_id)
    elif unassigned:
        query = query.filter(TaskLink.owner_id.is_(None))
    if overdue:
        query = query.filter(target.due_date < date.today())
    if search:
        escaped = search.replace("!", "!!").replace("%", "!%").replace("_", "!_")
        pattern = f"%{escaped}%"
        query = query.filter(or_(
            source.task_name.ilike(pattern, escape="!"),
            target.task_name.ilike(pattern, escape="!"),
            Project.project_name.ilike(pattern, escape="!"),
        ))
    total_count = query.count()
    rows = query.order_by(
        target.due_date.asc().nullslast(), TaskLink.created_at.asc(),
    ).offset(skip).limit(limit).all()
    items = [BlockedTaskRead(
        link_id=row[0], project_id=row[1], project_name=row[2],
        source_task_id=row[3], source_task_name=row[4],
        target_task_id=row[5], target_task_name=row[6], target_due_date=row[7],
        owner_id=row[8], owner_name=row[9],
    ) for row in rows]
    return TaskDependencyListRead(total_count=total_count, items=items)


def get_blocked_tasks_summary(db: Session, current_user: User) -> BlockedTasksSummaryRead:
    """Count active tasks in the user's task scope that are blocked by status or an open dependency."""
    visible_task_ids = _visible_tasks_query(db, current_user).with_entities(Task.task_id).subquery()
    blocked_by_status = db.query(Task.task_id.label("task_id")).filter(
        Task.task_id.in_(visible_task_ids), Task.status == "BLOCKED",
    )
    blocked_by_dependency = db.query(TaskLink.target_task_id.label("task_id")).join(
        Task, Task.task_id == TaskLink.source_task_id,
    ).filter(
        TaskLink.organization_id == current_user.organization_id,
        TaskLink.link_type == "BLOCKS",
        TaskLink.source_task_id.in_(visible_task_ids),
        TaskLink.target_task_id.in_(visible_task_ids),
        TaskLink.target_task_id != TaskLink.source_task_id,
        Task.status.notin_(("DONE", "CANCELLED")),
    )
    dependency_target = aliased(Task)
    blocked_by_dependency = blocked_by_dependency.join(
        dependency_target, dependency_target.task_id == TaskLink.target_task_id,
    ).filter(dependency_target.status.notin_(("DONE", "CANCELLED")))
    blocked_by_board = db.query(KanbanTask.task_id.label("task_id")).join(
        KanbanColumn, KanbanColumn.column_id == KanbanTask.column_id,
    ).join(
        Task, Task.task_id == KanbanTask.task_id,
    ).filter(
        Task.task_id.in_(visible_task_ids),
        Task.status.notin_(("DONE", "CANCELLED")),
        func.upper(func.trim(KanbanColumn.column_name)) == "BLOCKED",
    )
    blocked_ids = blocked_by_status.union(blocked_by_dependency, blocked_by_board).subquery()
    count = db.query(func.count()).select_from(blocked_ids).scalar() or 0
    dependency_result = get_task_dependencies(db, current_user, limit=20)
    return BlockedTasksSummaryRead(count=count, items=dependency_result.items)


def move_backlog_task(db: Session, task_id: UUID, direction: str, actor: User) -> None:
    task = get_task(db, task_id, current_user=actor)
    if task.status != "TODO" or task.sprint_id is not None:
        raise HTTPException(status_code=400, detail="Only unplanned To Do tasks can be reordered in the backlog")
    rows = db.query(Task).filter(
        Task.project_id == task.project_id,
        Task.status == "TODO",
        Task.sprint_id.is_(None),
    ).with_for_update().order_by(Task.backlog_rank.asc(), Task.created_at.asc(), Task.task_id.asc()).all()
    current_index = next((index for index, row in enumerate(rows) if row.task_id == task_id), None)
    if current_index is None:
        raise HTTPException(status_code=404, detail="Task not found in the project backlog")
    target_index = current_index + (-1 if direction == "UP" else 1)
    if target_index < 0 or target_index >= len(rows):
        return
    rows[current_index], rows[target_index] = rows[target_index], rows[current_index]
    for rank, row in enumerate(rows):
        row.backlog_rank = rank
    db.add(TaskActivity(
        task_id=task.task_id,
        actor_id=actor.user_id,
        event_type="BACKLOG_REORDERED",
        details=f"Moved the task {direction.lower()} in the project backlog.",
    ))
    db.commit()


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


def _is_direct_task_color(value: str) -> bool:
    return len(value) == 7 and value.startswith("#") and all(character in "0123456789abcdefABCDEF" for character in value[1:])


def create_task(
    db: Session,
    payload: TaskCreate,
    assigned_by: User,
) -> Task:
    """Create a task and notify its project team and assignee."""
    if not payload.labels:
        raise HTTPException(status_code=422, detail="Choose a color label before creating the task")
    known_label_keys = {row[0] for row in db.query(KanbanLabel.label_key).filter(
        KanbanLabel.organization_id == assigned_by.organization_id,
        KanbanLabel.label_key.in_(payload.labels),
    ).all()}
    invalid_labels = [label for label in payload.labels if label not in known_label_keys and not _is_direct_task_color(label)]
    if invalid_labels:
        raise HTTPException(status_code=422, detail="Choose a saved workspace label or a valid task color")
    if not has_permission(db, assigned_by, "projects.manage"):
        visible_project_ids = repository.get_visible_project_ids(db, assigned_by.user_id)
        if payload.project_id not in visible_project_ids:
            raise HTTPException(status_code=404, detail="Project not found")
    _validate_task_due_date(db, payload.project_id, payload.due_date, assigned_by.organization_id)
    _validate_task_date_range(payload.start_date, payload.due_date)
    _validate_team_lead_assignee(db, payload.project_id, assigned_by, payload.user_id)
    _validate_team_assignment(db, payload.project_id, assigned_by, payload.team_id, payload.user_id)
    _validate_goal_link(db, payload.project_id, payload.goal_id)
    _validate_release_link(db, payload.project_id, payload.release_id)
    _validate_component_link(db, payload.project_id, payload.component_id, assigned_by)
    payload = payload.model_copy(update={
        "custom_fields": _validate_task_custom_fields(
            db, payload.project_id, assigned_by.organization_id, payload.custom_fields,
        ),
    })
    payload = payload.model_copy(update={
        "checklist_items": _prepare_checklist_items(
            db, payload.project_id, assigned_by.organization_id, [], payload.checklist_items, assigned_by,
        ),
    })
    try:
        _validate_task_links(db, payload.project_id, payload.parent_task_id, payload.sprint_id, payload.task_type)
        task = repository.create_task(db, payload, commit=False)
        if task.release_id:
            release_name = db.query(ProjectRelease.name).filter(
                ProjectRelease.release_id == task.release_id,
                ProjectRelease.project_id == task.project_id,
                ProjectRelease.organization_id == assigned_by.organization_id,
            ).scalar()
            if release_name:
                record_release_scope_change(
                    db, organization_id=assigned_by.organization_id, project_id=task.project_id,
                    release_id=task.release_id, release_name=release_name, task_id=task.task_id,
                    task_name=task.task_name, actor_id=assigned_by.user_id, event_type="ADDED",
                )
        if task.status == "TODO" and task.sprint_id is None:
            last_rank = db.query(func.max(Task.backlog_rank)).filter(
                Task.project_id == task.project_id,
                Task.status == "TODO",
                Task.sprint_id.is_(None),
                Task.task_id != task.task_id,
            ).scalar()
            task.backlog_rank = (last_rank if last_rank is not None else -1) + 1
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
            start_date = task.start_date or (project.start_date if project and project.start_date else task.due_date)
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
        db.add(TaskStatusHistory(
            organization_id=task.organization_id,
            task_id=task.task_id,
            task_name=task.task_name,
            actor_id=assigned_by.user_id,
            from_status=None,
            to_status=task.status,
        ))
        _record_activity(db, task, assigned_by, "CREATED", f"Created {task.task_type.lower()} “{task.task_name}”.")
        if task.due_date:
            _record_activity(db, task, assigned_by, "DEADLINE_UPDATED", f"Set task deadline to {task.due_date.isoformat()}.")
        if task.reminder_days_before is not None:
            _record_activity(
                db, task, assigned_by, "REMINDER_UPDATED",
                f"Set an in-app reminder {_REMINDER_TEXT[task.reminder_days_before]}.",
            )
        if task.checklist_items:
            _record_activity(db, task, assigned_by, "CHECKLIST_UPDATED", _checklist_activity_details([], task.checklist_items))
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
    if (
        "due_date" in payload.model_fields_set
        and payload.due_date is None
        and "reminder_days_before" not in payload.model_fields_set
        and current_task.reminder_days_before is not None
    ):
        payload = payload.model_copy(update={"reminder_days_before": None})
    if "checklist_items" in payload.model_fields_set:
        prepared_items = _prepare_checklist_items(
            db, current_task.project_id, current_task.organization_id,
            current_task.checklist_items or [], payload.checklist_items, assigned_by,
        )
        payload = payload.model_copy(update={"checklist_items": prepared_items})
    if "due_date" in payload.model_fields_set:
        _validate_task_due_date(db, current_task.project_id, payload.due_date, assigned_by.organization_id)
    _validate_task_date_range(
        payload.start_date if "start_date" in payload.model_fields_set else current_task.start_date,
        payload.due_date if "due_date" in payload.model_fields_set else current_task.due_date,
    )
    effective_due_date = payload.due_date if "due_date" in payload.model_fields_set else current_task.due_date
    effective_reminder = payload.reminder_days_before if "reminder_days_before" in payload.model_fields_set else current_task.reminder_days_before
    if effective_reminder is not None and effective_due_date is None:
        raise HTTPException(status_code=400, detail="Choose a due date before setting a reminder")
    review_is_pending = _is_task_in_review(db, current_task) and not (
        payload.status == "IN_REVIEW" and current_task.status != "IN_REVIEW"
    )
    changes_review_status = review_is_pending and payload.status is not None and payload.status != current_task.status
    review_approval_pending = review_is_pending and payload.status == "DONE"
    is_assigned_reviewer = changes_review_status and (
        db.query(Project.project_id).filter(
            Project.project_id == current_task.project_id,
            Project.project_manager_user_id == assigned_by.user_id,
        ).first() is not None
        or current_task.team_id is not None and db.query(TeamLead.team_lead_id).join(
            Team, Team.team_lead_id == TeamLead.team_lead_id
        ).filter(Team.team_id == current_task.team_id, TeamLead.user_id == assigned_by.user_id).first() is not None
    )
    if changes_review_status and not is_assigned_reviewer:
        raise ForbiddenException(message="This task is awaiting review. Only its assigned Team Lead or Project Manager can change its status.")
    if payload.status is not None:
        _validate_task_transition(
            current_task.status,
            payload.status,
            can_manage=has_permission(db, assigned_by, "tasks.manage") or has_permission(db, assigned_by, "roles.manage"),
            review_pending=review_is_pending,
            assigned_reviewer=is_assigned_reviewer,
            allowed_transitions=_project_task_transitions(db, current_task),
        )
    if "user_id" in payload.model_fields_set:
        _validate_team_lead_assignee(db, current_task.project_id, assigned_by, payload.user_id)
        _validate_team_assignment(db, current_task.project_id, assigned_by, current_task.team_id, payload.user_id, task_id=current_task.task_id)
    if "goal_id" in payload.model_fields_set:
        _validate_goal_link(db, current_task.project_id, payload.goal_id)
    if "release_id" in payload.model_fields_set:
        _validate_release_link(db, current_task.project_id, payload.release_id)
    if "component_id" in payload.model_fields_set:
        _validate_component_link(db, current_task.project_id, payload.component_id, assigned_by)
    if "custom_fields" in payload.model_fields_set:
        payload = payload.model_copy(update={
            "custom_fields": _validate_task_custom_fields(
                db, current_task.project_id, assigned_by.organization_id, payload.custom_fields,
                existing=current_task.custom_fields,
            ),
        })
    previous_assignee_id = current_task.user_id
    previous_status = current_task.status
    previous_sprint_id = current_task.sprint_id
    previous_release_id = current_task.release_id
    previous_story_points = current_task.story_points
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
        if previous_release_id != task.release_id:
            if previous_release_id is not None:
                previous_release = db.query(ProjectRelease).filter(
                    ProjectRelease.release_id == previous_release_id,
                    ProjectRelease.organization_id == assigned_by.organization_id,
                ).one_or_none()
                if previous_release:
                    record_release_scope_change(
                        db, organization_id=assigned_by.organization_id, project_id=current_task.project_id,
                        release_id=previous_release_id, release_name=previous_release.name,
                        task_id=task.task_id, task_name=current_task.task_name,
                        actor_id=assigned_by.user_id, event_type="REMOVED",
                    )
            if task.release_id is not None:
                new_release = db.query(ProjectRelease).filter(
                    ProjectRelease.release_id == task.release_id,
                    ProjectRelease.project_id == task.project_id,
                    ProjectRelease.organization_id == assigned_by.organization_id,
                ).one_or_none()
                if new_release:
                    record_release_scope_change(
                        db, organization_id=assigned_by.organization_id, project_id=task.project_id,
                        release_id=task.release_id, release_name=new_release.name,
                        task_id=task.task_id, task_name=task.task_name,
                        actor_id=assigned_by.user_id, event_type="ADDED",
                    )
        if previous_sprint_id != task.sprint_id:
            if previous_sprint_id is not None:
                _record_sprint_scope_change(
                    db, sprint_id=previous_sprint_id, task=current_task, actor=assigned_by,
                    event_type="REMOVED", points_before=previous_story_points, points_after=None,
                )
            if task.sprint_id is not None:
                _record_sprint_scope_change(
                    db, sprint_id=task.sprint_id, task=task, actor=assigned_by,
                    event_type="ADDED", points_before=None, points_after=task.story_points,
                )
        elif task.sprint_id is not None and previous_story_points != task.story_points:
            _record_sprint_scope_change(
                db, sprint_id=task.sprint_id, task=task, actor=assigned_by,
                event_type="POINTS_CHANGED", points_before=previous_story_points, points_after=task.story_points,
            )
        if task.status == "TODO" and task.sprint_id is None and (previous_status != "TODO" or previous_sprint_id is not None):
            last_rank = db.query(func.max(Task.backlog_rank)).filter(
                Task.project_id == task.project_id,
                Task.status == "TODO",
                Task.sprint_id.is_(None),
                Task.task_id != task.task_id,
            ).scalar()
            task.backlog_rank = (last_rank if last_rank is not None else -1) + 1
        _sync_planning_views(db, task, assigned_by.user_id)
        if task.status == "DONE" and previous_status != "DONE":
            finish_task_tracking(db, task, assigned_by)
            if review_is_pending:
                _record_activity(db, task, assigned_by, "REVIEW_APPROVED", "Project Manager or Team Lead approved this task review.")
        elif task.status == "IN_REVIEW" and previous_status != "IN_REVIEW":
            pause_task_tracking_for_review(db, task, assigned_by)
            _record_activity(db, task, assigned_by, "REVIEW_SUBMITTED", "Task was submitted for review.")
        if {"due_date", "start_date", "user_id"} & payload.model_fields_set:
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
                if field == "status":
                    _record_status_transition(db, task, assigned_by, previous, current)
                    continue
                if field == "checklist_items":
                    _record_activity(db, task, assigned_by, "CHECKLIST_UPDATED", _checklist_activity_details(previous, current))
                    continue
                if field == "labels":
                    _record_activity(db, task, assigned_by, "LABELS_UPDATED", f"Updated task labels ({len(current or [])} assigned).")
                    continue
                if field == "due_date":
                    previous_deadline = _activity_value(db, field, previous)
                    current_deadline = _activity_value(db, field, current)
                    _record_activity(
                        db, task, assigned_by, "DEADLINE_UPDATED",
                        f"Changed task deadline from {previous_deadline} to {current_deadline}.",
                    )
                    continue
                if field == "reminder_days_before":
                    previous_reminder = _REMINDER_TEXT.get(previous) if previous is not None else "none"
                    current_reminder = _REMINDER_TEXT.get(current) if current is not None else "none"
                    _record_activity(
                        db, task, assigned_by, "REMINDER_UPDATED",
                        f"Changed the in-app reminder from {previous_reminder} to {current_reminder}.",
                    )
                    continue
                if field == "custom_fields":
                    previous_fields = previous or {}
                    current_fields = current or {}
                    changed_ids = {
                        field_id for field_id in set(previous_fields) | set(current_fields)
                        if previous_fields.get(field_id) != current_fields.get(field_id)
                    }
                    if changed_ids:
                        field_names = db.query(ProjectCustomField.name).filter(
                            ProjectCustomField.field_id.in_(changed_ids),
                            ProjectCustomField.project_id == task.project_id,
                            ProjectCustomField.organization_id == assigned_by.organization_id,
                        ).order_by(ProjectCustomField.name).all()
                        names = ", ".join(name for (name,) in field_names) or "project custom fields"
                        _record_activity(db, task, assigned_by, "CUSTOM_FIELDS_UPDATED", f"Updated custom field values for: {names}.")
                    continue
                previous_label = _activity_value(db, field, previous)
                current_label = _activity_value(db, field, current)
                _record_activity(db, task, assigned_by, "UPDATED", f"Changed {field.replace('_', ' ')} from {previous_label} to {current_label}.")
        assignment_changed = assignment_was_sent and task.user_id != previous_assignee_id
        db.commit()
        db.refresh(task)
        if review_approval_pending and task.status == "DONE" and is_assigned_reviewer and send_notification:
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


def bulk_update_tasks(db: Session, payload: TaskBulkUpdate, actor: User) -> int:
    """Apply a bounded set of task field changes with per-task activity records."""
    tasks = [get_task(db, task_id, current_user=actor) for task_id in payload.task_ids]
    if "due_date" in payload.model_fields_set and payload.due_date is not None:
        for task in tasks:
            _validate_task_due_date(db, task.project_id, payload.due_date, actor.organization_id)
    changed = 0
    assignment_notifications: dict[tuple[UUID, UUID], list[str]] = {}
    try:
        assignee = db.query(User).filter(
            User.user_id == payload.assignee_id,
            User.organization_id == actor.organization_id,
            User.is_active.is_(True),
        ).one_or_none() if "assignee_id" in payload.model_fields_set and payload.assignee_id is not None else None

        for task in tasks:
            task_changed = False
            if "priority" in payload.model_fields_set and task.priority != payload.priority:
                previous_priority = task.priority
                task.priority = payload.priority
                _record_activity(
                    db, task, actor, "PRIORITY_CHANGED",
                    f"Changed priority from {previous_priority.title()} to {payload.priority.title()} using a bulk update.",
                )
                task_changed = True
            if "assignee_id" in payload.model_fields_set and task.user_id != payload.assignee_id:
                _validate_team_lead_assignee(db, task.project_id, actor, payload.assignee_id)
                _validate_team_assignment(db, task.project_id, actor, task.team_id, payload.assignee_id, task_id=task.task_id)
                previous_assignee_id = task.user_id
                previous_assignee_name = _activity_value(db, "user_id", previous_assignee_id)
                task.user_id = payload.assignee_id
                _sync_planning_views(db, task, actor.user_id)
                db.query(CalendarEvent).filter(
                    CalendarEvent.related_task_id == task.task_id,
                    CalendarEvent.is_automatic.is_(True),
                ).delete(synchronize_session=False)
                if task.due_date:
                    add_automatic_calendar_entries(
                        db,
                        project_id=task.project_id,
                        actor_id=actor.user_id,
                        title=f"Task deadline: {task.task_name}",
                        description=f"Current due date for {task.task_name}.",
                        event_type="Deadline",
                        personal_user_ids={task.user_id or actor.user_id},
                        event_date=task.due_date,
                        related_task_id=task.task_id,
                    )
                current_assignee_name = assignee.name if assignee else "Unassigned"
                _record_activity(
                    db, task, actor, "UPDATED",
                    f"Changed assignee from {previous_assignee_name} to {current_assignee_name} using a bulk update.",
                )
                if assignee:
                    assignment_notifications.setdefault((assignee.user_id, task.project_id), []).append(task.task_name)
                task_changed = True
            if "due_date" in payload.model_fields_set and task.due_date != payload.due_date:
                previous_due_date = task.due_date
                task.due_date = payload.due_date
                previous_reminder = task.reminder_days_before
                if task.due_date is None:
                    task.reminder_days_before = None
                _sync_planning_views(db, task, actor.user_id)
                db.query(CalendarEvent).filter(
                    CalendarEvent.related_task_id == task.task_id,
                    CalendarEvent.is_automatic.is_(True),
                    CalendarEvent.event_type == "Deadline",
                ).delete(synchronize_session=False)
                if task.due_date:
                    add_automatic_calendar_entries(
                        db,
                        project_id=task.project_id,
                        actor_id=actor.user_id,
                        title=f"Task deadline: {task.task_name}",
                        description=f"Current due date for {task.task_name}.",
                        event_type="Deadline",
                        personal_user_ids={task.user_id or actor.user_id},
                        event_date=task.due_date,
                        related_task_id=task.task_id,
                    )
                _record_activity(
                    db, task, actor, "UPDATED",
                    f"Changed due date from {_activity_value(db, 'due_date', previous_due_date)} to {_activity_value(db, 'due_date', task.due_date)} using a bulk update.",
                )
                if previous_reminder is not None and task.reminder_days_before is None:
                    _record_activity(
                        db, task, actor, "REMINDER_UPDATED",
                        f"Removed the in-app reminder because the task deadline was cleared (previously {_REMINDER_TEXT[previous_reminder]}).",
                    )
                task_changed = True
            if task_changed:
                changed += 1
        if changed:
            db.commit()
            for (user_id, project_id), task_names in assignment_notifications.items():
                visible_names = ", ".join(task_names[:5])
                remaining = len(task_names) - min(len(task_names), 5)
                if remaining:
                    visible_names = f"{visible_names}, and {remaining} more"
                notify_users(
                    db, {user_id}, actor_id=actor.user_id, project_id=project_id,
                    title="Tasks assigned to you",
                    message=f"{actor.name} assigned you to: {visible_names}.",
                    notification_type="Task Assignment",
                )
    except Exception:
        if db.in_transaction():
            db.rollback()
        raise
    return changed


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
    if task.release_id is not None:
        release_name = db.query(ProjectRelease.name).filter(
            ProjectRelease.release_id == task.release_id,
            ProjectRelease.project_id == task.project_id,
            ProjectRelease.organization_id == deleted_by.organization_id,
        ).scalar()
        if release_name:
            record_release_scope_change(
                db, organization_id=deleted_by.organization_id, project_id=task.project_id,
                release_id=task.release_id, release_name=release_name, task_id=task.task_id,
                task_name=task_name, actor_id=deleted_by.user_id, event_type="REMOVED",
            )
    try:
        deleted = repository.delete_task(db, task_id, commit=False)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found",
            )
        db.commit()
    except Exception:
        db.rollback()
        raise
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


def get_status_history(db: Session, task_id: UUID, current_user: User) -> list[TaskStatusHistoryRead]:
    get_task(db, task_id, current_user=current_user)
    rows = db.query(TaskStatusHistory).filter(
        TaskStatusHistory.organization_id == current_user.organization_id,
        TaskStatusHistory.task_id == task_id,
    ).order_by(TaskStatusHistory.created_at.desc(), TaskStatusHistory.history_id.desc()).limit(500).all()
    return [TaskStatusHistoryRead.model_validate(row) for row in rows]


def _work_session_read(
    session: TaskWorkSession,
    visible_project_ids: set[UUID] | None = None,
) -> dict:
    now = datetime.now(timezone.utc)
    elapsed = max(0, int(((session.ended_at or now) - session.started_at).total_seconds()))
    links = [
        link for link in session.task_links
        if (visible_project_ids is None or (link.task and link.task.project_id in visible_project_ids))
        and (session.ended_at is None or not link.pending_review)
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
    sessions = [
        session for session in sessions
        if not (session.ended_at is not None and session.task_links and all(link.pending_review for link in session.task_links))
    ]
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
        item = totals.setdefault(link.task_id, {
            "task_id": link.task_id,
            "duration_seconds": 0,
            "reported_duration_seconds": 0,
            "pending_review_seconds": 0,
            "is_tracking": False,
            "is_reported_tracking": False,
            "active_since": None,
        })
        if link.ended_at is not None:
            item["duration_seconds"] += link.duration_seconds
            if link.pending_review:
                item["pending_review_seconds"] += link.duration_seconds
            else:
                item["reported_duration_seconds"] += link.duration_seconds
        else:
            item["is_tracking"] = True
            item["active_since"] = link.linked_at.isoformat()
            if link.pending_review:
                item["pending_review_seconds"] += link.duration_seconds
            else:
                item["is_reported_tracking"] = True
                item["reported_duration_seconds"] += link.duration_seconds
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
        link.pending_review = False
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
    pending_links = db.query(TaskWorkSessionTask).filter(
        TaskWorkSessionTask.task_id == task.task_id,
        TaskWorkSessionTask.organization_id == task.organization_id,
        TaskWorkSessionTask.pending_review.is_(True),
    ).all()
    approved_seconds = sum(link.duration_seconds for link in pending_links)
    for link in pending_links:
        link.pending_review = False
    if approved_seconds:
        _record_activity(db, task, actor, "TIME_APPROVED", f"Review approved; {approved_seconds} seconds of tracked task time were added to dashboard totals.")
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


def pause_task_tracking_for_review(db: Session, task: Task, actor: User) -> None:
    """Pause active timer segments; keep their time pending until review is approved."""
    now = datetime.now(timezone.utc)
    active_links = db.query(TaskWorkSessionTask).filter(
        TaskWorkSessionTask.task_id == task.task_id,
        TaskWorkSessionTask.organization_id == task.organization_id,
        TaskWorkSessionTask.ended_at.is_(None),
    ).all()
    closed_sessions: dict[UUID, TaskWorkSession] = {}
    for link in active_links:
        linked_at = link.linked_at if link.linked_at.tzinfo else link.linked_at.replace(tzinfo=timezone.utc)
        link.ended_at = now
        link.duration_seconds += max(0, int((now - linked_at).total_seconds()))
        link.pending_review = True
        if link.session and link.session.ended_at is None:
            closed_sessions[link.session.work_session_id] = link.session
        _record_activity(db, task, actor, "TIMER_PAUSED_FOR_REVIEW", "Task submitted for review; tracked time is pending PM approval.")
    db.flush()
    for session in closed_sessions.values():
        if not any(link.ended_at is None for link in session.task_links):
            session.ended_at = now
            started_at = session.started_at if session.started_at.tzinfo else session.started_at.replace(tzinfo=timezone.utc)
            session.duration_seconds = max(0, int((now - started_at).total_seconds()))


def cancel_task_review(db: Session, task: Task, comment: str, actor: User) -> KanbanTask:
    """Send a review task back to To Do with PM feedback and retain pending time."""
    project = db.query(Project).filter(
        Project.project_id == task.project_id,
        Project.organization_id == actor.organization_id,
        Project.project_manager_user_id == actor.user_id,
    ).one_or_none()
    if project is None:
        raise ForbiddenException(message="Only this project's assigned Project Manager can request review changes.")
    if not _is_task_in_review(db, task):
        raise HTTPException(status_code=409, detail="Only tasks in In Review can be sent back for changes.")
    placement = db.query(KanbanTask).filter(KanbanTask.task_id == task.task_id).one_or_none()
    if placement is None:
        raise HTTPException(status_code=409, detail="This task does not have a Kanban card.")
    columns = db.query(KanbanColumn).filter(KanbanColumn.project_id == task.project_id).all()
    todo_column = next((column for column in columns if column.column_name.strip().upper() in {"TO DO", "TODO", "BACKLOG"}), None)
    if todo_column is None:
        raise HTTPException(status_code=409, detail="This project's board needs a To Do column before changes can be requested.")

    last_position = db.query(func.max(KanbanTask.position)).filter(KanbanTask.column_id == todo_column.column_id).scalar()
    previous_status = task.status
    previous_column = db.get(KanbanColumn, placement.column_id)
    task.status = "TODO"
    placement.column_id = todo_column.column_id
    placement.position = (last_position if last_position is not None else -1) + 1
    placement.moved_by = actor.user_id
    last_rank = db.query(func.max(Task.backlog_rank)).filter(
        Task.project_id == task.project_id,
        Task.status == "TODO",
        Task.sprint_id.is_(None),
        Task.task_id != task.task_id,
    ).scalar()
    if task.sprint_id is None:
        task.backlog_rank = (last_rank if last_rank is not None else -1) + 1
    _sync_planning_views(db, task, actor.user_id)
    db.add(TaskComment(task_id=task.task_id, author_id=actor.user_id, content=comment))
    if previous_status != "TODO":
        _record_status_transition(db, task, actor, previous_status, "TODO")
    _record_activity(db, task, actor, "REVIEW_CHANGES_REQUESTED", f"PM requested changes: {comment}")
    if previous_column and previous_column.column_id != todo_column.column_id:
        _record_activity(db, task, actor, "KANBAN_MOVED", f"Moved the card from “{previous_column.column_name}” to “{todo_column.column_name}” after review changes were requested.")
    task.review_feedback = comment
    db.commit()
    db.refresh(placement)
    recipients = {task.user_id} if task.user_id else set()
    recipients.update(_task_team_lead_ids(db, task))
    notify_users(
        db, recipients, actor_id=actor.user_id, project_id=task.project_id,
        title=f"Changes requested: {task.task_name}",
        message=f"{actor.name} requested changes and moved the task back to To Do. Review the comment on the task card.",
        notification_type="Review Changes Requested",
    )
    return placement


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
    review_column_task_ids = set(db.query(KanbanTask.task_id).join(
        KanbanColumn, KanbanColumn.column_id == KanbanTask.column_id
    ).filter(
        KanbanTask.task_id.in_(task_ids),
        func.upper(func.trim(KanbanColumn.column_name)).in_(("IN REVIEW", "IN-REVIEW", "REVIEW")),
    ).all())
    review_column_task_ids = {task_id for (task_id,) in review_column_task_ids}
    if any(
        task.status in {"DONE", "CANCELLED", "IN_REVIEW"}
        or task.task_id in done_column_task_ids
        or task.task_id in review_column_task_ids
        for task in tasks
    ):
        raise HTTPException(status_code=409, detail="Completed, cancelled, or review-pending work cannot be started")

    can_manage_status = has_permission(db, current_user, "tasks.manage") or has_permission(db, current_user, "roles.manage")
    for task in tasks:
        if task.status != "IN_PROGRESS":
            _validate_task_transition(
                task.status,
                "IN_PROGRESS",
                can_manage=can_manage_status,
                review_pending=False,
                assigned_reviewer=False,
                allowed_transitions=_project_task_transitions(db, task),
            )

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
            has_pending_review_time = db.query(TaskWorkSessionTask.task_id).filter(
                TaskWorkSessionTask.task_id == task.task_id,
                TaskWorkSessionTask.organization_id == current_user.organization_id,
                TaskWorkSessionTask.pending_review.is_(True),
            ).first() is not None
            session.task_links.append(TaskWorkSessionTask(
                task_id=task.task_id,
                organization_id=current_user.organization_id,
                linked_at=now,
                pending_review=has_pending_review_time,
            ))
            _record_activity(db, task, current_user, "TIMER_LINKED", f"Added this task to shared work session {session.work_session_id}.")
        elif link.ended_at is not None:
            link.linked_at = now
            link.ended_at = None
            _record_activity(db, task, current_user, "TIMER_LINKED", f"Resumed tracking this task in shared work session {session.work_session_id}.")
        if task.status != "IN_PROGRESS":
            previous_status = task.status
            task.status = "IN_PROGRESS"
            _sync_planning_views(db, task, current_user.user_id)
            _record_status_transition(db, task, current_user, previous_status, task.status)
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


def _build_sprint_burndown(
    sprint: TaskSprint,
    scope_events: list[TaskSprintScopeChange],
    status_events: list[TaskStatusHistory],
    current_statuses: dict[UUID, str],
) -> tuple[list[SprintBurndownPointRead], int | None, list[float]]:
    """Reconstruct daily sprint scope from its baseline, scope changes, and status history."""
    if sprint.status == "PLANNED":
        return [], None, []
    baseline_events = [
        event for event in scope_events
        if event.event_type == "BASELINE"
        and (sprint.started_at is None or event.created_at >= sprint.started_at)
    ]
    if not baseline_events:
        return [], None, []

    baseline_at = min(event.created_at for event in baseline_events)
    tracking_start = max(sprint.started_at, baseline_at) if sprint.started_at else baseline_at
    finish_at = sprint.completed_at if sprint.status == "COMPLETED" and sprint.completed_at else datetime.now(timezone.utc)
    if finish_at < tracking_start:
        return [], None, []

    histories_by_task: dict[UUID, list[TaskStatusHistory]] = {}
    for event in sorted(status_events, key=lambda item: (item.created_at, str(item.history_id))):
        histories_by_task.setdefault(event.task_id, []).append(event)

    def status_at(task_id: UUID, at: datetime) -> str:
        prior_status = None
        for event in histories_by_task.get(task_id, []):
            if event.created_at <= at:
                prior_status = event.to_status
                continue
            if prior_status is not None:
                return prior_status
            if event.from_status is not None:
                return event.from_status
            break
        return prior_status or current_statuses.get(task_id, "TODO")

    timeline: list[tuple[datetime, int, str, str, object]] = []
    for event in scope_events:
        if event.task_id is not None and tracking_start <= event.created_at <= finish_at:
            timeline.append((event.created_at, 0, str(event.scope_change_id), "scope", event))
    for event in status_events:
        if tracking_start <= event.created_at <= finish_at:
            timeline.append((event.created_at, 1, str(event.history_id), "status", event))
    timeline.sort(key=lambda item: (item[0], item[1], item[2]))

    initial_points = sum(max(0, event.points_after or 0) for event in baseline_events)
    end_day = finish_at.date()
    start_day = tracking_start.date()
    duration = max(1, ((sprint.end_date or end_day) - start_day).days)
    day_count = max(0, (end_day - start_day).days)
    step = max(1, (day_count + 119) // 120)
    days = [start_day + timedelta(days=offset) for offset in range(0, day_count + 1, step)]
    if not days or days[-1] != end_day:
        days.append(end_day)

    members: dict[UUID, int] = {}
    statuses: dict[UUID, str] = {}
    cursor = 0
    points: list[SprintBurndownPointRead] = []
    cycle_time_days: list[float] = []
    for day in days:
        day_end = datetime.combine(day, time.max, tzinfo=timezone.utc)
        cutoff = min(day_end, finish_at)
        throughput_completed_tasks = 0
        while cursor < len(timeline) and timeline[cursor][0] <= cutoff:
            _at, _priority, _key, event_kind, event = timeline[cursor]
            cursor += 1
            if event_kind == "scope":
                task_id = event.task_id
                if task_id is None:
                    continue
                if event.event_type in {"BASELINE", "ADDED"}:
                    members[task_id] = max(0, event.points_after or 0)
                    statuses[task_id] = status_at(task_id, event.created_at)
                elif event.event_type == "REMOVED":
                    members.pop(task_id, None)
                    statuses.pop(task_id, None)
                elif event.event_type == "POINTS_CHANGED" and task_id in members:
                    members[task_id] = max(0, event.points_after or 0)
            elif event_kind == "status":
                if event.task_id not in members:
                    continue
                previous_status = statuses.get(event.task_id)
                if event.to_status == "DONE" and previous_status != "DONE":
                    throughput_completed_tasks += 1
                    starts = [
                        history for history in histories_by_task.get(event.task_id, [])
                        if history.to_status == "IN_PROGRESS" and history.created_at < event.created_at
                    ]
                    if starts:
                        cycle_start = starts[-1].created_at
                        cycle_time_days.append(max(0.0, (event.created_at - cycle_start).total_seconds() / 86400))
                statuses[event.task_id] = event.to_status

        status_counts = {
            task_status: sum(1 for task_id in members if statuses.get(task_id) == task_status)
            for task_status in _ALLOWED_TASK_TRANSITIONS
        }
        completed_points = sum(value for task_id, value in members.items() if statuses.get(task_id) == "DONE")
        remaining_points = sum(
            value for task_id, value in members.items()
            if statuses.get(task_id) not in {"DONE", "CANCELLED"}
        )
        remaining_tasks = sum(
            1 for task_id in members
            if statuses.get(task_id) not in {"DONE", "CANCELLED"}
        )
        elapsed = max(0, (day - start_day).days)
        ideal_points = round(initial_points * max(0.0, 1 - elapsed / duration), 2)
        points.append(SprintBurndownPointRead(
            date=day,
            remaining_points=remaining_points,
            ideal_points=ideal_points,
            completed_points=completed_points,
            remaining_tasks=remaining_tasks,
            throughput_completed_tasks=throughput_completed_tasks,
            status_counts=status_counts,
        ))

    return points, initial_points, cycle_time_days


def get_sprint_report(db: Session, sprint_id: UUID, current_user: User) -> SprintReportRead:
    sprint = db.query(TaskSprint).filter(
        TaskSprint.sprint_id == sprint_id,
        TaskSprint.organization_id == current_user.organization_id,
    ).one_or_none()
    if sprint is None:
        raise HTTPException(status_code=404, detail="Sprint not found")

    visible_project_ids = repository.get_visible_project_ids(db, current_user.user_id)
    can_manage_workspace_tasks = has_permission(db, current_user, "tasks.manage")
    if not has_permission(db, current_user, "roles.manage") and not can_manage_workspace_tasks and sprint.project_id not in visible_project_ids:
        raise HTTPException(status_code=404, detail="Sprint not found")

    can_view_all_project_tasks = has_permission(db, current_user, "roles.manage") or can_manage_workspace_tasks
    if not can_view_all_project_tasks:
        managed_project_ids = {row[0] for row in db.query(Project.project_id).filter(
            Project.organization_id == current_user.organization_id,
            Project.project_manager_user_id == current_user.user_id,
        ).all()}
        lead_ids = db.query(TeamLead.team_lead_id).filter(
            TeamLead.user_id == current_user.user_id,
            TeamLead.organization_id == current_user.organization_id,
        ).subquery()
        managed_project_ids.update(row[0] for row in db.query(Team.project_id).filter(
            Team.organization_id == current_user.organization_id,
            Team.team_lead_id.in_(lead_ids),
        ).all())
        can_view_all_project_tasks = sprint.project_id in managed_project_ids

    query = db.query(Task.status, func.count(Task.task_id), func.coalesce(func.sum(Task.story_points), 0)).filter(
        Task.organization_id == current_user.organization_id,
        Task.sprint_id == sprint.sprint_id,
        Task.project_id == sprint.project_id,
    )
    if not can_view_all_project_tasks:
        query = query.filter(Task.user_id == current_user.user_id)
    rows = query.group_by(Task.status).all()
    status_counts = {task_status: int(count) for task_status, count, _points in rows}
    points_by_status = {task_status: int(points or 0) for task_status, _count, points in rows}
    total_tasks = sum(status_counts.values())
    completed_tasks = status_counts.get("DONE", 0)
    cancelled_tasks = status_counts.get("CANCELLED", 0)
    completed_points = points_by_status.get("DONE", 0)
    current_scope_points = sum(points for task_status, points in points_by_status.items() if task_status != "CANCELLED")
    overdue_query = db.query(func.count(Task.task_id)).filter(
        Task.organization_id == current_user.organization_id,
        Task.project_id == sprint.project_id,
        Task.sprint_id == sprint.sprint_id,
        Task.due_date < date.today(),
        Task.status.notin_(("DONE", "CANCELLED")),
    )
    if not can_view_all_project_tasks:
        overdue_query = overdue_query.filter(Task.user_id == current_user.user_id)
    scope_filter = [
        TaskSprintScopeChange.organization_id == current_user.organization_id,
        TaskSprintScopeChange.sprint_id == sprint.sprint_id,
    ]
    if not can_view_all_project_tasks:
        visible_project_task_ids = db.query(Task.task_id).filter(
            Task.organization_id == current_user.organization_id,
            Task.project_id == sprint.project_id,
            Task.user_id == current_user.user_id,
        ).subquery()
        scope_filter.append(TaskSprintScopeChange.task_id.in_(visible_project_task_ids))
    scope_changes = db.query(TaskSprintScopeChange).filter(*scope_filter).order_by(
        TaskSprintScopeChange.created_at.desc(), TaskSprintScopeChange.scope_change_id.desc(),
    ).limit(100).all()
    scope_history = db.query(TaskSprintScopeChange).filter(*scope_filter).order_by(
        TaskSprintScopeChange.created_at, TaskSprintScopeChange.scope_change_id,
    ).all()
    current_cycle_scope_filter = list(scope_filter)
    if sprint.started_at is not None:
        current_cycle_scope_filter.append(TaskSprintScopeChange.created_at >= sprint.started_at)
    history_task_ids = {change.task_id for change in scope_history if change.task_id is not None}
    status_history = db.query(TaskStatusHistory).filter(
        TaskStatusHistory.organization_id == current_user.organization_id,
        TaskStatusHistory.task_id.in_(history_task_ids) if history_task_ids else False,
    ).order_by(TaskStatusHistory.created_at, TaskStatusHistory.history_id).all()
    history_tasks = db.query(Task.task_id, Task.status).filter(
        Task.organization_id == current_user.organization_id,
        Task.project_id == sprint.project_id,
        Task.task_id.in_(history_task_ids) if history_task_ids else False,
    )
    if not can_view_all_project_tasks:
        history_tasks = history_tasks.filter(Task.user_id == current_user.user_id)
    current_statuses = {task_id: task_status for task_id, task_status in history_tasks.all()}
    burndown, baseline_points, cycle_time_days = _build_sprint_burndown(
        sprint, scope_history, status_history, current_statuses,
    )

    velocity_history: list[SprintVelocityRead] = []
    velocity_candidates = db.query(TaskSprint).filter(
        TaskSprint.organization_id == current_user.organization_id,
        TaskSprint.project_id == sprint.project_id,
        TaskSprint.status == "COMPLETED",
        TaskSprint.completed_at.is_not(None),
    ).order_by(TaskSprint.completed_at.desc(), TaskSprint.sprint_id).limit(20).all()
    for candidate in velocity_candidates:
        if len(velocity_history) == 5:
            break
        if candidate.sprint_id == sprint.sprint_id:
            candidate_scope_history = scope_history
            candidate_status_history = status_history
            candidate_current_statuses = current_statuses
        else:
            candidate_scope_query = db.query(TaskSprintScopeChange).filter(
                TaskSprintScopeChange.organization_id == current_user.organization_id,
                TaskSprintScopeChange.sprint_id == candidate.sprint_id,
            )
            if not can_view_all_project_tasks:
                candidate_visible_ids = db.query(Task.task_id).filter(
                    Task.organization_id == current_user.organization_id,
                    Task.project_id == sprint.project_id,
                    Task.user_id == current_user.user_id,
                ).subquery()
                candidate_scope_query = candidate_scope_query.filter(TaskSprintScopeChange.task_id.in_(candidate_visible_ids))
            candidate_scope_history = candidate_scope_query.order_by(
                TaskSprintScopeChange.created_at, TaskSprintScopeChange.scope_change_id,
            ).all()
            candidate_task_ids = {change.task_id for change in candidate_scope_history if change.task_id is not None}
            candidate_status_history = db.query(TaskStatusHistory).filter(
                TaskStatusHistory.organization_id == current_user.organization_id,
                TaskStatusHistory.task_id.in_(candidate_task_ids) if candidate_task_ids else False,
            ).order_by(TaskStatusHistory.created_at, TaskStatusHistory.history_id).all()
            candidate_task_query = db.query(Task.task_id, Task.status).filter(
                Task.organization_id == current_user.organization_id,
                Task.project_id == sprint.project_id,
                Task.task_id.in_(candidate_task_ids) if candidate_task_ids else False,
            )
            if not can_view_all_project_tasks:
                candidate_task_query = candidate_task_query.filter(Task.user_id == current_user.user_id)
            candidate_current_statuses = {task_id: task_status for task_id, task_status in candidate_task_query.all()}
        candidate_burndown, _candidate_baseline, _candidate_cycle_times = _build_sprint_burndown(
            candidate, candidate_scope_history, candidate_status_history, candidate_current_statuses,
        )
        if not candidate_burndown or candidate.completed_at is None:
            continue
        velocity_history.append(SprintVelocityRead(
            sprint_id=candidate.sprint_id,
            sprint_name=candidate.sprint_name,
            completed_at=candidate.completed_at,
            delivered_points=candidate_burndown[-1].completed_points,
        ))

    added_points = db.query(func.coalesce(func.sum(TaskSprintScopeChange.points_after), 0)).filter(
        *current_cycle_scope_filter, TaskSprintScopeChange.event_type == "ADDED",
    ).scalar()
    removed_points = db.query(func.coalesce(func.sum(TaskSprintScopeChange.points_before), 0)).filter(
        *current_cycle_scope_filter, TaskSprintScopeChange.event_type == "REMOVED",
    ).scalar()
    average_velocity = (
        round(sum(item.delivered_points for item in velocity_history) / len(velocity_history), 1)
        if velocity_history else None
    )
    return SprintReportRead(
        sprint_id=sprint.sprint_id,
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        remaining_tasks=max(0, total_tasks - completed_tasks - cancelled_tasks),
        overdue_tasks=int(overdue_query.scalar() or 0),
        current_scope_points=current_scope_points,
        completed_points=completed_points,
        remaining_points=max(0, current_scope_points - completed_points),
        capacity_points=sprint.capacity_points,
        original_scope_points=baseline_points,
        scope_added_points=int(added_points or 0),
        scope_removed_points=int(removed_points or 0),
        scope_changes=scope_changes,
        status_counts=status_counts,
        started_at=sprint.started_at,
        completed_at=sprint.completed_at,
        history_start_date=burndown[0].date if burndown else None,
        burndown_history_available=bool(burndown),
        burndown=burndown,
        velocity_points=(burndown[-1].completed_points if sprint.status == "COMPLETED" and burndown else None),
        velocity_basis="PROJECT" if can_view_all_project_tasks else "MY_ASSIGNED_TASKS",
        velocity_history=velocity_history,
        average_velocity_points=average_velocity,
        total_throughput_tasks=sum(point.throughput_completed_tasks for point in burndown),
        average_cycle_time_days=(round(sum(cycle_time_days) / len(cycle_time_days), 1) if cycle_time_days else None),
        median_cycle_time_days=(round(median(cycle_time_days), 1) if cycle_time_days else None),
        cycle_time_sample_count=len(cycle_time_days),
    )


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
    starting_sprint = sprint.status != "ACTIVE" and values.get("status") == "ACTIVE"
    completing_sprint = sprint.status != "COMPLETED" and values.get("status") == "COMPLETED"
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
    if starting_sprint:
        sprint.started_at = datetime.now(timezone.utc)
        sprint.completed_at = None
        current_scope_tasks = db.query(Task).filter(
            Task.organization_id == current_user.organization_id,
            Task.project_id == sprint.project_id,
            Task.sprint_id == sprint.sprint_id,
        ).all()
        for task in current_scope_tasks:
            _record_sprint_scope_change(
                db, sprint_id=sprint.sprint_id, task=task, actor=current_user,
                event_type="BASELINE", points_before=None, points_after=task.story_points,
                occurred_at=sprint.started_at,
            )
        if not current_scope_tasks:
            db.add(TaskSprintScopeChange(
                organization_id=current_user.organization_id,
                sprint_id=sprint.sprint_id,
                task_id=None,
                task_name=sprint.sprint_name,
                actor_id=current_user.user_id,
                event_type="BASELINE",
                points_before=None,
                points_after=0,
                created_at=sprint.started_at,
            ))
    elif completing_sprint:
        sprint.completed_at = datetime.now(timezone.utc)
    elif values.get("status") in {"PLANNED", "ACTIVE"}:
        sprint.completed_at = None
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
