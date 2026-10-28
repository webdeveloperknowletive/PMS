"""
==========================================================
                KANBAN SERVICE
==========================================================

Business logic layer for Kanban Columns and Tasks (card
placements). Orchestrates calls to repository.py and
translates "not found" into HTTP errors. Routers should
only ever call this layer, never the model or repository
directly.
"""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.kanban import repository
from app.modules.kanban.model import KanbanCardMember, KanbanColumn, KanbanLabel, KanbanTask
from app.modules.kanban.schema import (
    KanbanColumnCreate,
    KanbanColumnUpdate,
    KanbanTaskCreate,
    KanbanTaskUpdate,
    KanbanCardMemberOptionRead,
    KanbanLabelCreate,
    KanbanLabelUpdate,
)
from app.core.permissions import has_permission
from app.modules.projects.model import Project
from app.modules.tasks.model import Task, TaskActivity
from app.modules.tasks.repository import get_visible_project_ids
from app.modules.teams.model import Team, TeamLead, TeamMember
from app.modules.users.model import User


def _normalize_label_key(name: str) -> str:
    return name.strip().casefold()


def get_kanban_labels(db: Session, organization_id: UUID) -> list[KanbanLabel]:
    return db.query(KanbanLabel).filter(
        KanbanLabel.organization_id == organization_id,
    ).order_by(KanbanLabel.name.asc()).all()


def create_kanban_label(db: Session, payload: KanbanLabelCreate, actor: User) -> KanbanLabel:
    name = " ".join(payload.name.strip().split())
    label_key = _normalize_label_key(name)
    existing = db.query(KanbanLabel).filter(
        KanbanLabel.organization_id == actor.organization_id,
        KanbanLabel.label_key == label_key,
    ).one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A label with this name already exists.")
    label = KanbanLabel(
        organization_id=actor.organization_id,
        label_key=label_key,
        name=name,
        color=payload.color.upper(),
        created_by_user_id=actor.user_id,
    )
    db.add(label)
    db.commit()
    db.refresh(label)
    return label


def update_kanban_label(db: Session, label_id: UUID, payload: KanbanLabelUpdate, actor: User) -> KanbanLabel:
    label = db.query(KanbanLabel).filter(
        KanbanLabel.label_id == label_id,
        KanbanLabel.organization_id == actor.organization_id,
    ).one_or_none()
    if label is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Label not found.")
    if payload.name is not None:
        name = " ".join(payload.name.strip().split())
        label_key = _normalize_label_key(name)
        duplicate = db.query(KanbanLabel.label_id).filter(
            KanbanLabel.organization_id == actor.organization_id,
            KanbanLabel.label_key == label_key,
            KanbanLabel.label_id != label_id,
        ).first()
        if duplicate:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A label with this name already exists.")
        old_key = label.label_key
        if old_key != label_key:
            for task in db.query(Task).filter(Task.organization_id == actor.organization_id).all():
                current = task.labels or []
                if any(_normalize_label_key(value) == old_key for value in current):
                    renamed = [label_key if _normalize_label_key(value) == old_key else _normalize_label_key(value) for value in current]
                    task.labels = list(dict.fromkeys(renamed))
        label.name = name
        label.label_key = label_key
    if payload.color is not None:
        label.color = payload.color.upper()
    db.commit()
    db.refresh(label)
    return label


def _board_scope(db: Session, user: User) -> tuple[set[UUID] | None, bool]:
    if has_permission(db, user, "roles.manage"):
        return None, True
    owned_project_ids = {row[0] for row in db.query(Project.project_id).filter(Project.project_manager_user_id == user.user_id).all()}
    lead_ids = db.query(TeamLead.team_lead_id).filter(TeamLead.user_id == user.user_id).subquery()
    lead_projects = {row[0] for row in db.query(Team.project_id).filter(Team.team_lead_id.in_(lead_ids)).all()}
    privileged_projects = owned_project_ids | lead_projects
    if privileged_projects:
        return privileged_projects, True
    visible = get_visible_project_ids(db, user.user_id)
    return visible, False


# ==========================================================
# Kanban Columns
# ==========================================================

def get_kanban_columns(db: Session, current_user: User, skip: int = 0, limit: int = 100) -> list[KanbanColumn]:
    """Get all Kanban columns (paginated, ordered by position)."""
    project_ids, _ = _board_scope(db, current_user)
    query = db.query(KanbanColumn)
    if project_ids is not None:
        query = query.filter(KanbanColumn.project_id.in_(project_ids)) if project_ids else query.filter(False)
    return query.order_by(KanbanColumn.position.asc()).offset(skip).limit(limit).all()


def get_kanban_column(db: Session, column_id: UUID, current_user: User) -> KanbanColumn:
    """Get a single Kanban column by ID, or raise 404."""
    column = repository.get_kanban_column(db, column_id)
    project_ids, _ = _board_scope(db, current_user)
    if column is None or (project_ids is not None and column.project_id not in project_ids):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanban column not found")
    return column


def create_kanban_column(db: Session, payload: KanbanColumnCreate) -> KanbanColumn:
    """Create a new Kanban column."""
    return repository.create_kanban_column(db, payload)


def update_kanban_column(db: Session, column_id: UUID, payload: KanbanColumnUpdate) -> KanbanColumn:
    """Update an existing Kanban column, or raise 404."""
    column = repository.update_kanban_column(db, column_id, payload)
    if column is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanban column not found")
    return column


def delete_kanban_column(db: Session, column_id: UUID) -> None:
    """Delete a Kanban column, or raise 404."""
    deleted = repository.delete_kanban_column(db, column_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanban column not found")


# ==========================================================
# Kanban Tasks (card placements)
# ==========================================================

def get_kanban_tasks(db: Session, current_user: User, skip: int = 0, limit: int = 100) -> list[KanbanTask]:
    """Get all Kanban task placements (paginated)."""
    project_ids, can_view_project_tasks = _board_scope(db, current_user)
    query = db.query(KanbanTask).join(KanbanColumn, KanbanTask.column_id == KanbanColumn.column_id).join(Task, Task.task_id == KanbanTask.task_id).filter(
        Task.organization_id == current_user.organization_id,
        Task.archived_at.is_(None),
    )
    if project_ids is not None:
        query = query.filter(KanbanColumn.project_id.in_(project_ids)) if project_ids else query.filter(False)
    if not can_view_project_tasks:
        query = query.filter(Task.user_id == current_user.user_id)
    return query.order_by(KanbanTask.position.asc()).offset(skip).limit(limit).all()


def get_archived_cards(db: Session, current_user: User, project_id: UUID | None = None) -> list[Task]:
    project_ids, can_view_project_tasks = _board_scope(db, current_user)
    query = db.query(Task).filter(
        Task.organization_id == current_user.organization_id,
        Task.archived_at.is_not(None),
    )
    if project_id is not None:
        query = query.filter(Task.project_id == project_id)
    if project_ids is not None:
        query = query.filter(Task.project_id.in_(project_ids)) if project_ids else query.filter(False)
    if not can_view_project_tasks:
        query = query.filter(Task.user_id == current_user.user_id)
    return query.order_by(Task.archived_at.desc()).limit(500).all()


def get_card_for_board(db: Session, task_id: UUID, current_user: User) -> Task:
    task = db.query(Task).filter(
        Task.task_id == task_id,
        Task.organization_id == current_user.organization_id,
    ).one_or_none()
    project_ids, can_view_project_tasks = _board_scope(db, current_user)
    if task is None or (project_ids is not None and task.project_id not in project_ids) or (
        not can_view_project_tasks and task.user_id != current_user.user_id
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanban card not found")
    return task


def _eligible_card_member_ids(db: Session, task: Task) -> set[UUID]:
    active_teams = db.query(Team.team_id).filter(
        Team.organization_id == task.organization_id,
        Team.project_id == task.project_id,
        Team.status == "ACTIVE",
    )
    project_members = db.query(TeamMember.user_id).filter(
        TeamMember.organization_id == task.organization_id,
        TeamMember.team_id.in_(active_teams),
    )
    project_leads = db.query(TeamLead.user_id).join(
        Team, Team.team_lead_id == TeamLead.team_lead_id,
    ).filter(
        Team.organization_id == task.organization_id,
        Team.project_id == task.project_id,
        Team.status == "ACTIVE",
    )
    eligible_ids = project_members.union(project_leads).subquery()
    return {row[0] for row in db.query(User.user_id).filter(
        User.organization_id == task.organization_id,
        User.is_active.is_(True),
        User.user_id.in_(eligible_ids),
    ).all()}


def get_card_member_options(db: Session, task: Task) -> list[KanbanCardMemberOptionRead]:
    eligible_ids = _eligible_card_member_ids(db, task)
    assigned_ids = {row[0] for row in db.query(KanbanCardMember.user_id).filter(
        KanbanCardMember.organization_id == task.organization_id,
        KanbanCardMember.task_id == task.task_id,
    ).all()}
    # Keep old assignments visible so an administrator can remove them after a
    # member is deactivated or leaves the project team.
    users = db.query(User).filter(
        User.organization_id == task.organization_id,
        User.user_id.in_(eligible_ids | assigned_ids),
    ).order_by(User.name.asc(), User.user_id.asc()).all()
    return [KanbanCardMemberOptionRead(
        user_id=user.user_id,
        name=user.name,
        profile_picture_url=user.profile_picture_url,
        is_active=user.is_active,
        is_eligible=user.user_id in eligible_ids,
    ) for user in users]


def update_card_members(db: Session, task: Task, member_ids: list[UUID], actor: User) -> Task:
    if task.archived_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Restore this card before changing its members.")

    requested_ids = set(member_ids)
    if task.user_id is not None:
        requested_ids.discard(task.user_id)  # The primary task assignee stays assigned separately.
    current_assignments = {assignment.user_id: assignment for assignment in task.kanban_member_assignments}
    additions = requested_ids - set(current_assignments)
    removals = set(current_assignments) - requested_ids
    eligible_ids = _eligible_card_member_ids(db, task)
    if additions - eligible_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose active members from this project's teams.")
    if not additions and not removals:
        return task

    changed_ids = additions | removals
    users = {user.user_id: user for user in db.query(User).filter(
        User.organization_id == task.organization_id,
        User.user_id.in_(changed_ids),
    ).all()}
    for user_id in additions:
        member = users[user_id]
        db.add(KanbanCardMember(
            organization_id=task.organization_id,
            task_id=task.task_id,
            user_id=user_id,
            assigned_by_user_id=actor.user_id,
        ))
        db.add(TaskActivity(
            organization_id=task.organization_id,
            task_id=task.task_id,
            actor_id=actor.user_id,
            event_type="CARD_MEMBER_ADDED",
            details=f"Added {member.name} as a member of this card.",
        ))
    for user_id in removals:
        member = users.get(user_id)
        db.delete(current_assignments[user_id])
        db.add(TaskActivity(
            organization_id=task.organization_id,
            task_id=task.task_id,
            actor_id=actor.user_id,
            event_type="CARD_MEMBER_REMOVED",
            details=f"Removed {member.name if member else 'a former member'} from this card.",
        ))
    db.commit()
    db.refresh(task)
    return task


def set_card_archived(db: Session, task: Task, actor: User, archived: bool) -> Task:
    if archived == (task.archived_at is not None):
        return task
    if not archived:
        placement = task.kanban_entry
        column = placement.column if placement else None
        if column is not None:
            _enforce_wip_limit(db, column, task.status)
    task.archived_at = func.now() if archived else None
    task.archived_by_user_id = actor.user_id if archived else None
    db.add(TaskActivity(
        organization_id=task.organization_id,
        task_id=task.task_id,
        actor_id=actor.user_id,
        event_type="ARCHIVED" if archived else "RESTORED",
        details=f"{actor.name} {'archived' if archived else 'restored'} this Kanban card.",
    ))
    db.commit()
    db.refresh(task)
    return task


def get_kanban_task(db: Session, kanban_task_id: UUID, current_user: User) -> KanbanTask:
    """Get a single Kanban task placement by ID, or raise 404."""
    kanban_task = repository.get_kanban_task(db, kanban_task_id)
    project_ids, can_view_project_tasks = _board_scope(db, current_user)
    permitted = kanban_task is not None and kanban_task.task.archived_at is None and (project_ids is None or kanban_task.column.project_id in project_ids) and (
        can_view_project_tasks or kanban_task.task.user_id == current_user.user_id
    )
    if not permitted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanban task not found")
    return kanban_task


def create_kanban_task(db: Session, payload: KanbanTaskCreate) -> KanbanTask:
    """Place a task on the board for the first time."""
    task = db.get(Task, payload.task_id)
    column = db.get(KanbanColumn, payload.column_id)
    if task is None or column is None or task.project_id != column.project_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose a board column from the task's project")
    if task.archived_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Restore this task before adding it to the active board")
    _enforce_wip_limit(db, column, task.status)
    return repository.create_kanban_task(db, payload)


def _enforce_wip_limit(db: Session, column: KanbanColumn, task_status: str, current: KanbanTask | None = None) -> None:
    if column.wip_limit is None or task_status in {"DONE", "CANCELLED"} or (current and current.column_id == column.column_id):
        return
    active_count = db.query(func.count(KanbanTask.kanban_task_id)).join(
        Task, Task.task_id == KanbanTask.task_id,
    ).filter(
        KanbanTask.column_id == column.column_id,
        Task.archived_at.is_(None),
        Task.status.notin_(("DONE", "CANCELLED")),
    ).scalar() or 0
    if active_count >= column.wip_limit:
        raise HTTPException(status_code=409, detail=f"{column.column_name} has reached its work-in-progress limit ({column.wip_limit})")


def update_kanban_task(db: Session, kanban_task_id: UUID, payload: KanbanTaskUpdate) -> KanbanTask:
    """
    Generic field update for a Kanban task placement (e.g. correcting
    position without a full drag-move). For an actual drag-and-drop
    move between columns, use move_kanban_task() instead, so `moved_by`
    and `moved_at` get set correctly.
    """
    current = repository.get_kanban_task(db, kanban_task_id)
    if current is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanban task not found")
    if current.task.archived_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanban task not found")
    if payload.column_id is not None:
        target = db.get(KanbanColumn, payload.column_id)
        if target is None or current.task.project_id != target.project_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose a board column from the task's project")
        _enforce_wip_limit(db, target, current.task.status, current)
    kanban_task = repository.update_kanban_task(db, kanban_task_id, payload)
    if kanban_task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanban task not found")
    return kanban_task


def move_kanban_task(
    db: Session,
    kanban_task_id: UUID,
    column_id: UUID,
    position: int,
    moved_by: UUID,
) -> KanbanTask:
    """
    Move a task to a (possibly different) column and position, stamping
    who moved it. This is the actual "drag a card" action — previously
    only existed in repository.py and was never reachable through the
    API; every move went through the generic update instead, silently
    losing the moved_by/moved_at stamp.
    """
    current = repository.get_kanban_task(db, kanban_task_id)
    target = db.get(KanbanColumn, column_id)
    if current is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanban task not found")
    if current.task.archived_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanban task not found")
    if target is None or current.task.project_id != target.project_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose a board column from the task's project")
    _enforce_wip_limit(db, target, current.task.status, current)
    kanban_task = repository.move_kanban_task(db, kanban_task_id, column_id, position, moved_by=moved_by)
    if kanban_task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanban task not found")
    return kanban_task


def delete_kanban_task(db: Session, kanban_task_id: UUID) -> None:
    """Remove a task from the board, or raise 404."""
    deleted = repository.delete_kanban_task(db, kanban_task_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kanban task not found")
