"""
==========================================================
                TEAMS SERVICE
==========================================================

Business logic layer for Team Leads, Teams and Team
Members. Orchestrates calls to repository.py and
translates "not found" into HTTP errors. Routers should
only ever call this layer, never the model or repository
directly.
"""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from sqlalchemy.orm import joinedload, selectinload

from app.modules.teams import repository
from app.modules.teams.model import Team, TeamLead, TeamMember
from app.modules.projects.model import Project
from app.modules.teams.schema import (
    TeamCreate,
    TeamLeadCreate,
    TeamMemberCreate,
    TeamMemberUpdate,
    TeamUpdate,
)
from app.modules.notifications.events import notify_project_users
from app.modules.users.model import User
from app.modules.roles.model import Role, UserRole
from app.modules.tasks.model import Task
from app.modules.calendar.automatic import add_automatic_calendar_entries
from app.core.permissions import has_permission


# ==========================================================
# Team Leads
# ==========================================================

def get_team_member_candidates(db: Session, current_user: User) -> list[User]:
    """Return only active Developer accounts in this workspace."""
    return db.query(User).join(UserRole, UserRole.user_id == User.user_id).join(
        Role, Role.role_id == UserRole.role_id
    ).options(selectinload(User.user_roles).joinedload(UserRole.role)).filter(
        User.organization_id == current_user.organization_id,
        User.is_active.is_(True),
        func.lower(Role.role_name) == "developer",
    ).distinct().order_by(User.name.asc()).all()


def get_available_team_members(db: Session, team_id: UUID, current_user: User) -> list[User]:
    """Return assigned team members with no unfinished task in this project."""
    team = db.query(Team).filter(
        Team.team_id == team_id,
        Team.organization_id == current_user.organization_id,
    ).one_or_none()
    if team is None:
        raise HTTPException(status_code=404, detail="Team not found")

    is_assigned_lead = db.query(TeamLead.team_lead_id).filter(
        TeamLead.team_lead_id == team.team_lead_id,
        TeamLead.user_id == current_user.user_id,
    ).first() is not None
    is_project_manager = db.query(Project.project_id).filter(
        Project.project_id == team.project_id,
        Project.project_manager_user_id == current_user.user_id,
    ).first() is not None
    if not (is_assigned_lead or is_project_manager or has_permission(db, current_user, "roles.manage")):
        raise HTTPException(status_code=404, detail="Team not found")

    member_ids = [row[0] for row in db.query(TeamMember.user_id).filter(TeamMember.team_id == team_id).all()]
    if not member_ids:
        return []
    busy_ids = {row[0] for row in db.query(Task.user_id).filter(
        Task.project_id == team.project_id,
        Task.user_id.in_(member_ids),
        Task.status.notin_(("DONE", "CANCELLED")),
    ).all()}
    available_ids = set(member_ids) - busy_ids
    if not available_ids:
        return []
    return db.query(User).join(UserRole, UserRole.user_id == User.user_id).join(
        Role, Role.role_id == UserRole.role_id
    ).options(selectinload(User.user_roles).joinedload(UserRole.role)).filter(
        User.user_id.in_(available_ids),
        User.organization_id == current_user.organization_id,
        User.is_active.is_(True),
        func.lower(Role.role_name) == "developer",
    ).distinct().order_by(User.name.asc()).all()


def get_team_leads(db: Session, current_user: User, skip: int = 0, limit: int = 100) -> list[TeamLead]:
    query = db.query(TeamLead)
    if not has_permission(db, current_user, "teams.manage"):
        query = query.filter(TeamLead.user_id == current_user.user_id)
    return query.order_by(TeamLead.created_at.desc()).offset(skip).limit(limit).all()


def get_team_lead(db: Session, team_lead_id: UUID) -> TeamLead:
    team_lead = repository.get_team_lead(db, team_lead_id)
    if team_lead is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team lead not found")
    return team_lead


def get_team_lead_by_user(db: Session, user_id: UUID) -> TeamLead:
    team_lead = repository.get_team_lead_by_user(db, user_id)
    if team_lead is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This user is not a team lead")
    return team_lead


def create_team_lead(db: Session, payload: TeamLeadCreate) -> TeamLead:
    existing = repository.get_team_lead_by_user(db, payload.user_id)
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This user is already a team lead")
    return repository.create_team_lead(db, payload)


def delete_team_lead(db: Session, team_lead_id: UUID) -> None:
    deleted = repository.delete_team_lead(db, team_lead_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team lead not found")


# ==========================================================
# Teams
# ==========================================================

def get_teams(db: Session, current_user: User, skip: int = 0, limit: int = 100) -> list[Team]:
    if has_permission(db, current_user, "roles.manage"):
        return repository.get_teams(db, skip=skip, limit=limit)
    own_project_ids = db.query(Project.project_id).filter(
        Project.project_manager_user_id == current_user.user_id
    ).subquery()
    has_owned_projects = db.query(Project.project_id).filter(Project.project_manager_user_id == current_user.user_id).first() is not None
    own_lead = db.query(TeamLead.team_lead_id).filter(TeamLead.user_id == current_user.user_id).scalar()
    if has_owned_projects:
        query = db.query(Team).filter(Team.project_id.in_(own_project_ids))
        if own_lead is not None:
            query = db.query(Team).filter((Team.project_id.in_(own_project_ids)) | (Team.team_lead_id == own_lead))
        return query.order_by(
            Team.created_at.desc()
        ).offset(skip).limit(limit).all()
    if own_lead is not None:
        return db.query(Team).filter(Team.team_lead_id == own_lead).order_by(
            Team.created_at.desc()
        ).offset(skip).limit(limit).all()
    if has_permission(db, current_user, "teams.manage"):
        return repository.get_teams(db, skip=skip, limit=limit)
    lead_ids = db.query(TeamLead.team_lead_id).filter(TeamLead.user_id == current_user.user_id).subquery()
    visible_team_ids = {row[0] for row in db.query(Team.team_id).filter(Team.team_lead_id.in_(lead_ids)).all()}
    visible_team_ids.update(row[0] for row in db.query(TeamMember.team_id).filter(TeamMember.user_id == current_user.user_id).all())
    if not visible_team_ids:
        return []
    return db.query(Team).filter(Team.team_id.in_(visible_team_ids)).order_by(Team.created_at.desc()).offset(skip).limit(limit).all()


def get_team(db: Session, team_id: UUID, current_user: User | None = None) -> Team:
    team = repository.get_team(db, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    if current_user and not has_permission(db, current_user, "roles.manage"):
        if has_permission(db, current_user, "projects.manage") or db.query(Project.project_id).filter(
            Project.project_id == team.project_id, Project.project_manager_user_id == current_user.user_id
        ).first():
            is_own_project = db.query(Project.project_id).filter(Project.project_id == team.project_id, Project.project_manager_user_id == current_user.user_id).first()
            own_lead_id = db.query(TeamLead.team_lead_id).filter(TeamLead.user_id == current_user.user_id).scalar()
            if not is_own_project and team.team_lead_id != own_lead_id:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
            return team
        own_lead_id = db.query(TeamLead.team_lead_id).filter(TeamLead.user_id == current_user.user_id).scalar()
        if own_lead_id is not None and team.team_lead_id != own_lead_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
        if own_lead_id is None and has_permission(db, current_user, "teams.manage"):
            return team
        visible_ids = {item.team_id for item in get_teams(db, current_user, limit=10000)}
        if team_id not in visible_ids:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    return team


def create_team(db: Session, payload: TeamCreate, actor: User) -> Team:
    project = db.query(Project).filter(Project.project_id == payload.project_id).one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    is_manager = project.project_manager_user_id == actor.user_id or has_permission(db, actor, "roles.manage")
    own_lead_id = db.query(TeamLead.team_lead_id).filter(TeamLead.user_id == actor.user_id).scalar()
    is_assigned_lead = bool(own_lead_id and db.query(Team.team_id).filter(
        Team.project_id == payload.project_id, Team.team_lead_id == own_lead_id
    ).first())
    if not is_manager and not is_assigned_lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if is_assigned_lead and not is_manager and payload.team_lead_id != own_lead_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only create a team that you lead")
    team = repository.create_team(db, payload)
    lead = db.get(TeamLead, team.team_lead_id)
    add_automatic_calendar_entries(
        db, project_id=team.project_id, actor_id=actor.user_id,
        title=f"Team created: {team.team_name}", description=f"{actor.name} created this project team.",
        event_type="Work activity",
        personal_user_ids={actor.user_id, *payload.member_user_ids, *({lead.user_id} if lead else set())},
    )
    db.commit()
    notify_project_users(
        db, team.project_id, actor_id=actor.user_id,
        additional_user_ids=set(payload.member_user_ids) | ({lead.user_id} if lead else set()),
        title=f"Team created: {team.team_name}",
        message=f"{actor.name} created this team and set up its membership.",
        notification_type="Team Created",
    )
    return team


def update_team(db: Session, team_id: UUID, payload: TeamUpdate, actor: User) -> Team:
    current = get_team(db, team_id, current_user=actor)
    team = repository.update_team(db, team_id, payload)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    target_ids = {member.user_id for member in current.members}
    lead = db.get(TeamLead, team.team_lead_id)
    if lead:
        target_ids.add(lead.user_id)
    add_automatic_calendar_entries(
        db, project_id=team.project_id, actor_id=actor.user_id,
        title=f"Team updated: {team.team_name}", description=f"{actor.name} updated the project team.",
        event_type="Work activity", personal_user_ids=target_ids | {actor.user_id},
    )
    db.commit()
    notify_project_users(
        db, team.project_id, actor_id=actor.user_id, additional_user_ids=target_ids,
        title=f"Team updated: {team.team_name}",
        message=f"{actor.name} updated the team details.",
        notification_type="Team Updated",
    )
    return team


def delete_team(db: Session, team_id: UUID, actor: User) -> None:
    team = get_team(db, team_id, current_user=actor)
    project_id, team_name = team.project_id, team.team_name
    recipient_ids = {member.user_id for member in team.members}
    lead = db.get(TeamLead, team.team_lead_id)
    if lead:
        recipient_ids.add(lead.user_id)
    add_automatic_calendar_entries(
        db, project_id=project_id, actor_id=actor.user_id,
        title=f"Team deleted: {team_name}", description=f"{actor.name} deleted the project team.",
        event_type="Work activity", personal_user_ids=recipient_ids | {actor.user_id},
    )
    deleted = repository.delete_team(db, team_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    notify_project_users(
        db, project_id, actor_id=actor.user_id, additional_user_ids=recipient_ids,
        title=f"Team deleted: {team_name}",
        message=f"{actor.name} deleted this team.",
        notification_type="Team Deleted",
    )


# ==========================================================
# Team Members
# ==========================================================

def get_team_members(db: Session, team_id: UUID, current_user: User | None = None) -> list[TeamMember]:
    get_team(db, team_id, current_user=current_user)
    return repository.get_members_by_team(db, team_id)


def add_team_member(db: Session, team_id: UUID, payload: TeamMemberCreate, actor: User) -> TeamMember:
    team = repository.get_team(db, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    full_payload = TeamMemberCreate(
        team_id=team_id,
        user_id=payload.user_id,
        responsibility=payload.responsibility,
    )
    member = repository.create_team_member(db, full_payload)
    add_automatic_calendar_entries(
        db, project_id=team.project_id, actor_id=actor.user_id,
        title=f"Added to team: {team.team_name}", description=f"{actor.name} added a team member.",
        event_type="Work activity", personal_user_ids={actor.user_id, payload.user_id},
    )
    db.commit()
    notify_project_users(
        db, team.project_id, actor_id=actor.user_id, additional_user_ids={payload.user_id},
        title=f"Added to team: {team.team_name}",
        message=f"{actor.name} added a member to the team.",
        notification_type="Team Membership",
    )
    return member


def update_team_member(db: Session, team_id: UUID, member_id: UUID, payload: TeamMemberUpdate, actor: User) -> TeamMember:
    member = repository.get_team_member(db, member_id)
    if member is None or member.team_id != team_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team member not found")
    updated = repository.update_team_member(db, member_id, payload)
    team = get_team(db, team_id)
    add_automatic_calendar_entries(
        db, project_id=team.project_id, actor_id=actor.user_id,
        title=f"Team responsibility updated: {team.team_name}", description=f"{actor.name} updated a member's team responsibility.",
        event_type="Work activity", personal_user_ids={actor.user_id, member.user_id},
    )
    db.commit()
    notify_project_users(
        db, team.project_id, actor_id=actor.user_id, additional_user_ids={member.user_id},
        title=f"Team responsibility updated: {team.team_name}",
        message=f"{actor.name} updated your team responsibility.",
        notification_type="Team Membership Updated",
    )
    return updated


def remove_team_member(db: Session, team_id: UUID, member_id: UUID, actor: User) -> None:
    member = repository.get_team_member(db, member_id)
    if member is None or member.team_id != team_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team member not found")
    team = get_team(db, team_id)
    removed_user_id = member.user_id
    add_automatic_calendar_entries(
        db, project_id=team.project_id, actor_id=actor.user_id,
        title=f"Removed from team: {team.team_name}", description=f"{actor.name} removed a team member.",
        event_type="Work activity", personal_user_ids={actor.user_id, removed_user_id},
    )
    repository.delete_team_member(db, member_id)
    notify_project_users(
        db, team.project_id, actor_id=actor.user_id, additional_user_ids={removed_user_id},
        title=f"Removed from team: {team.team_name}",
        message=f"{actor.name} removed a member from the team.",
        notification_type="Team Membership Removed",
    )
