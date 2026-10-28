from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session, aliased

from app.modules.projects import service as project_service
from app.modules.projects.model import Project
from app.modules.tasks.model import Task, TaskActivity, TaskLink
from app.modules.tasks.schema import TaskLinkCreate, TaskLinkOwnerUpdate
from app.modules.tasks.service import get_task
from app.modules.notifications.events import notify_users, users_with_permissions
from app.modules.teams.model import Team, TeamLead, TeamMember
from app.modules.users.model import User
from app.core.permissions import has_permission


def _read(link: TaskLink, source: Task, target: Task, owner_name: str | None = None) -> dict:
    return {
        "link_id": link.link_id,
        "source_task_id": link.source_task_id,
        "target_task_id": link.target_task_id,
        "owner_id": link.owner_id,
        "owner_name": owner_name,
        "source_task_name": source.task_name,
        "target_task_name": target.task_name,
        "link_type": link.link_type,
        "created_by": link.created_by,
        "created_at": link.created_at,
    }


def _would_create_cycle(db: Session, source_id: UUID, target_id: UUID, organization_id: UUID) -> bool:
    links = db.query(TaskLink.source_task_id, TaskLink.target_task_id).filter(
        TaskLink.link_type == "BLOCKS", TaskLink.organization_id == organization_id,
    ).all()
    outgoing: dict[UUID, list[UUID]] = {}
    for parent_id, child_id in links:
        outgoing.setdefault(parent_id, []).append(child_id)
    pending = [target_id]
    visited: set[UUID] = set()
    while pending:
        task_id = pending.pop()
        if task_id == source_id:
            return True
        if task_id in visited:
            continue
        visited.add(task_id)
        pending.extend(outgoing.get(task_id, []))
    return False


def list_links(db: Session, task_id: UUID, actor: User) -> list[dict]:
    task = get_task(db, task_id, current_user=actor)
    links = db.query(TaskLink).filter(
        (TaskLink.source_task_id == task_id) | (TaskLink.target_task_id == task_id),
        TaskLink.organization_id == actor.organization_id,
    ).order_by(TaskLink.created_at.asc()).all()
    result = []
    for link in links:
        source = db.get(Task, link.source_task_id)
        target = db.get(Task, link.target_task_id)
        if source and target and source.project_id == task.project_id and target.project_id == task.project_id:
            owner_name = db.query(User.name).filter(
                User.user_id == link.owner_id,
                User.organization_id == actor.organization_id,
            ).scalar() if link.owner_id else None
            result.append(_read(link, source, target, owner_name))
    return result


def list_project_links(db: Session, project_id: UUID, actor: User) -> list[dict]:
    project_service.get_project(db, project_id, actor)
    source = aliased(Task)
    target = aliased(Task)
    owner = aliased(User)
    rows = db.query(TaskLink, source, target, owner.name).join(
        source, TaskLink.source_task_id == source.task_id,
    ).join(
        target, TaskLink.target_task_id == target.task_id,
    ).outerjoin(
        owner, (TaskLink.owner_id == owner.user_id) & (owner.organization_id == actor.organization_id),
    ).filter(
        TaskLink.organization_id == actor.organization_id,
        source.project_id == project_id,
        target.project_id == project_id,
    ).order_by(TaskLink.created_at.asc()).all()
    return [_read(link, source_task, target_task, owner_name) for link, source_task, target_task, owner_name in rows]


def list_blocker_owner_candidates(db: Session, project_id: UUID, actor: User) -> list[dict]:
    project = project_service.get_project(db, project_id, actor)
    candidate_ids = users_with_permissions(db, "roles.manage")
    if project.project_manager_user_id:
        candidate_ids.add(project.project_manager_user_id)
    candidate_ids.update(row[0] for row in db.query(TeamLead.user_id).join(
        Team, Team.team_lead_id == TeamLead.team_lead_id,
    ).filter(Team.project_id == project_id).all())
    candidate_ids.update(row[0] for row in db.query(TeamMember.user_id).join(
        Team, TeamMember.team_id == Team.team_id,
    ).filter(Team.project_id == project_id).all())
    candidate_ids.update(row[0] for row in db.query(Task.user_id).filter(
        Task.project_id == project_id,
        Task.organization_id == actor.organization_id,
        Task.user_id.is_not(None),
    ).distinct().all())
    if not candidate_ids:
        return []
    rows = db.query(User.user_id, User.name).filter(
        User.organization_id == actor.organization_id,
        User.is_active.is_(True),
        User.user_id.in_(candidate_ids),
    ).order_by(User.name.asc()).all()
    return [{"user_id": user_id, "name": name} for user_id, name in rows]


def _validate_blocker_owner(db: Session, project_id: UUID, owner_id: UUID | None, actor: User) -> User | None:
    if owner_id is None:
        return None
    owner = db.query(User).filter(
        User.user_id == owner_id,
        User.organization_id == actor.organization_id,
        User.is_active.is_(True),
    ).one_or_none()
    if owner is None:
        raise HTTPException(status_code=400, detail="Choose an active user in this workspace")
    if has_permission(db, owner, "roles.manage"):
        return owner
    is_project_manager = db.query(Project.project_id).filter(
        Project.project_id == project_id,
        Project.project_manager_user_id == owner_id,
    ).first() is not None
    is_team_lead = db.query(Team.team_id).join(
        TeamLead, TeamLead.team_lead_id == Team.team_lead_id,
    ).filter(Team.project_id == project_id, TeamLead.user_id == owner_id).first() is not None
    is_team_member = db.query(Team.team_id).join(
        TeamMember, TeamMember.team_id == Team.team_id,
    ).filter(Team.project_id == project_id, TeamMember.user_id == owner_id).first() is not None
    is_project_assignee = db.query(Task.task_id).filter(
        Task.project_id == project_id,
        Task.organization_id == actor.organization_id,
        Task.user_id == owner_id,
    ).first() is not None
    if not (is_project_manager or is_team_lead or is_team_member or is_project_assignee):
        raise HTTPException(status_code=400, detail="Choose a project member as blocker owner")
    return owner


def create_link(db: Session, task_id: UUID, payload: TaskLinkCreate, actor: User) -> dict:
    source = get_task(db, task_id, current_user=actor)
    target = get_task(db, payload.target_task_id, current_user=actor)
    if source.task_id == target.task_id:
        raise HTTPException(status_code=400, detail="A task cannot be linked to itself")
    if source.project_id != target.project_id or source.organization_id != target.organization_id:
        raise HTTPException(status_code=400, detail="Choose a task from the same project")
    if payload.owner_id is not None and payload.link_type != "BLOCKS":
        raise HTTPException(status_code=400, detail="Only blocking links can have an owner")
    owner = _validate_blocker_owner(db, source.project_id, payload.owner_id, actor)
    exists = db.query(TaskLink.link_id).filter(
        TaskLink.link_type == payload.link_type,
        ((TaskLink.source_task_id == source.task_id) & (TaskLink.target_task_id == target.task_id))
        | ((TaskLink.source_task_id == target.task_id) & (TaskLink.target_task_id == source.task_id)),
    ).first()
    if exists:
        raise HTTPException(status_code=409, detail="These tasks are already linked")
    if payload.link_type == "BLOCKS" and _would_create_cycle(db, source.task_id, target.task_id, actor.organization_id):
        raise HTTPException(status_code=409, detail="This dependency would create a blocking cycle")
    link = TaskLink(
        organization_id=actor.organization_id,
        source_task_id=source.task_id,
        target_task_id=target.task_id,
        link_type=payload.link_type,
        owner_id=owner.user_id if owner else None,
        created_by=actor.user_id,
    )
    db.add(link)
    db.add(TaskActivity(task_id=source.task_id, actor_id=actor.user_id, event_type="LINK_CREATED", details=f"Linked this task to “{target.task_name}” ({payload.link_type.lower().replace('_', ' ')})."))
    if owner:
        db.add(TaskActivity(task_id=target.task_id, actor_id=actor.user_id, event_type="BLOCKER_OWNER_ASSIGNED", details=f"Assigned {owner.name} to resolve this blocker."))
    db.commit()
    db.refresh(link)
    if owner:
        notify_users(
            db, {owner.user_id}, actor_id=actor.user_id, project_id=source.project_id,
            title=f"Blocker owner assigned: {target.task_name}",
            message=f"{actor.name} assigned you to resolve a blocker for {target.task_name}.",
            notification_type="Blocker Assigned",
        )
    return _read(link, source, target, owner.name if owner else None)


def update_link_owner(db: Session, task_id: UUID, link_id: UUID, payload: TaskLinkOwnerUpdate, actor: User) -> dict:
    task = get_task(db, task_id, current_user=actor)
    link = db.query(TaskLink).filter(
        TaskLink.link_id == link_id,
        TaskLink.organization_id == actor.organization_id,
        ((TaskLink.source_task_id == task_id) | (TaskLink.target_task_id == task_id)),
    ).one_or_none()
    if link is None:
        raise HTTPException(status_code=404, detail="Task link not found")
    if link.link_type != "BLOCKS":
        raise HTTPException(status_code=400, detail="Only blocking links can have an owner")
    target = db.query(Task).filter(
        Task.task_id == link.target_task_id,
        Task.project_id == task.project_id,
        Task.organization_id == actor.organization_id,
    ).one_or_none()
    source = db.query(Task).filter(
        Task.task_id == link.source_task_id,
        Task.project_id == task.project_id,
        Task.organization_id == actor.organization_id,
    ).one_or_none()
    if source is None or target is None:
        raise HTTPException(status_code=404, detail="Task link not found")
    if link.owner_id == payload.owner_id:
        owner_name = db.query(User.name).filter(
            User.user_id == link.owner_id,
            User.organization_id == actor.organization_id,
        ).scalar() if link.owner_id else None
        return _read(link, source, target, owner_name)

    owner = _validate_blocker_owner(db, task.project_id, payload.owner_id, actor)
    previous_owner_name = db.query(User.name).filter(
        User.user_id == link.owner_id,
        User.organization_id == actor.organization_id,
    ).scalar() if link.owner_id else "Unassigned"
    link.owner_id = owner.user_id if owner else None
    current_owner_label = owner.name if owner else "Unassigned"
    db.add(TaskActivity(
        task_id=target.task_id,
        actor_id=actor.user_id,
        event_type="BLOCKER_OWNER_CHANGED",
        details=f"Changed blocker owner from {previous_owner_name} to {current_owner_label}.",
    ))
    db.commit()
    db.refresh(link)
    if owner:
        notify_users(
            db, {owner.user_id}, actor_id=actor.user_id, project_id=task.project_id,
            title=f"Blocker owner assigned: {target.task_name}",
            message=f"{actor.name} assigned you to resolve a blocker for {target.task_name}.",
            notification_type="Blocker Assigned",
        )
    return _read(link, source, target, owner.name if owner else None)


def delete_link(db: Session, task_id: UUID, link_id: UUID, actor: User) -> None:
    task = get_task(db, task_id, current_user=actor)
    link = db.query(TaskLink).filter(
        TaskLink.link_id == link_id,
        TaskLink.organization_id == actor.organization_id,
        ((TaskLink.source_task_id == task_id) | (TaskLink.target_task_id == task_id)),
    ).one_or_none()
    if link is None:
        raise HTTPException(status_code=404, detail="Task link not found")
    other_id = link.target_task_id if link.source_task_id == task_id else link.source_task_id
    other = db.get(Task, other_id)
    if other:
        db.add(TaskActivity(task_id=task.task_id, actor_id=actor.user_id, event_type="LINK_REMOVED", details=f"Removed a {link.link_type.lower().replace('_', ' ')} link to “{other.task_name}”."))
    db.delete(link)
    db.commit()
