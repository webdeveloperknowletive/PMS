"""
==========================================================
                PROJECTS SERVICE
==========================================================

Business logic layer for Projects. Orchestrates calls to
repository.py and translates "not found" into HTTP errors.
Routers should only ever call this layer, never the model
or repository directly.
"""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload, selectinload

from app.modules.projects import repository
from app.modules.projects.model import Project
from app.modules.projects.schema import ProjectAssignmentCandidateRead, ProjectCreate, ProjectUpdate
from app.modules.notifications.events import notify_users, project_recipient_ids, users_with_permissions
from app.modules.users.model import User
from app.modules.roles.model import Permission, RolePermission, UserRole
from app.modules.kanban.constants import DEFAULT_COLUMN_COLORS, DEFAULT_COLUMN_NAMES
from app.modules.kanban.model import KanbanColumn
from app.modules.teams.model import Team, TeamLead, TeamMember
from app.modules.workflow.model import Workflow
from app.modules.calendar.automatic import add_automatic_calendar_entries
from app.core.permissions import has_permission


def get_project_assignment_candidates(db: Session, current_user: User) -> list[ProjectAssignmentCandidateRead]:
    """Return active delivery-role users in the actor's organization for project setup."""
    users = (
        db.query(User)
        .options(selectinload(User.user_roles).joinedload(UserRole.role))
        .filter(User.organization_id == current_user.organization_id, User.is_active.is_(True))
        .order_by(User.name.asc())
        .all()
    )
    results = []
    for user in users:
        role_names = user.role_names
        if any(role.strip().casefold() in {"project manager", "team lead"} for role in role_names):
            results.append(ProjectAssignmentCandidateRead(
                user_id=user.user_id,
                name=user.name,
                role_names=role_names,
                is_active=user.is_active,
            ))
    return results


def _project_calendar_viewers(db: Session, organization_id: UUID) -> set[UUID]:
    """Users granted project visibility or management in this organization."""
    rows = (
        db.query(UserRole.user_id)
        .join(RolePermission, RolePermission.role_id == UserRole.role_id)
        .join(Permission, Permission.permission_id == RolePermission.permission_id)
        .join(User, User.user_id == UserRole.user_id)
        .filter(
            User.organization_id == organization_id,
            Permission.code.in_((
                "projects.view", "projects.create", "projects.update",
                "projects.delete", "roles.manage",
            )),
        )
        .distinct()
        .all()
    )
    return {row[0] for row in rows}


def get_projects(db: Session, current_user: User, skip: int = 0, limit: int = 100) -> list[Project]:
    """Return projects assigned to this manager or team lead."""
    # Workspace administrators need organization-wide visibility; all other
    # users remain scoped to projects assigned through their delivery role.
    if has_permission(db, current_user, "roles.manage"):
        return repository.get_projects_for_organization(
            db, current_user.organization_id, skip=skip, limit=limit
        )
    lead_ids = db.query(TeamLead.team_lead_id).filter(TeamLead.user_id == current_user.user_id).subquery()
    lead_projects = db.query(Team.project_id).filter(Team.team_lead_id.in_(lead_ids))
    member_projects = db.query(Team.project_id).join(TeamMember, TeamMember.team_id == Team.team_id).filter(
        TeamMember.user_id == current_user.user_id
    )
    return db.query(Project).filter(
        (Project.project_manager_user_id == current_user.user_id)
        | Project.project_id.in_(lead_projects)
        | Project.project_id.in_(member_projects)
    ).order_by(Project.created_at.desc()).offset(skip).limit(limit).all()


def get_project(db: Session, project_id: UUID, current_user: User) -> Project:
    """Get a single project by ID, or raise 404."""
    project = repository.get_project(db, project_id, organization_id=current_user.organization_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    is_assigned_lead = db.query(Team.team_id).join(TeamLead, Team.team_lead_id == TeamLead.team_lead_id).filter(
        Team.project_id == project_id, TeamLead.user_id == current_user.user_id
    ).first() is not None
    is_assigned_member = db.query(TeamMember.member_id).join(Team, Team.team_id == TeamMember.team_id).filter(
        Team.project_id == project_id, TeamMember.user_id == current_user.user_id
    ).first() is not None
    is_workspace_admin = has_permission(db, current_user, "roles.manage")
    if project.project_manager_user_id != current_user.user_id and not is_assigned_lead and not is_assigned_member and not is_workspace_admin:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def create_project(db: Session, payload: ProjectCreate, actor: User) -> Project:
    """Create a project with its starter board and optional delivery setup."""
    setup_fields = {
        "team_lead_user_id", "team_member_user_ids",
    }
    try:
        project = Project(**payload.model_dump(exclude=setup_fields))
        db.add(project)
        db.flush()

        db.add_all(
            KanbanColumn(
                project_id=project.project_id,
                column_name=name,
                position=position,
                color=DEFAULT_COLUMN_COLORS.get(name),
            )
            for position, name in enumerate(DEFAULT_COLUMN_NAMES)
        )

        lead_user_id = payload.team_lead_user_id
        lead_user = db.query(User).filter(User.user_id == lead_user_id, User.is_active.is_(True)).one_or_none()
        if lead_user is None or not any(role.strip().casefold() == "team lead" for role in lead_user.role_names):
            raise HTTPException(status_code=400, detail="Choose an active user with the Team Lead role")
        manager_user = db.query(User).filter(
            User.user_id == payload.project_manager_user_id, User.is_active.is_(True)
        ).one_or_none()
        if manager_user is None or not any(role.strip().casefold() == "project manager" for role in manager_user.role_names):
            raise HTTPException(status_code=400, detail="Choose an active user with the Project Manager role")
        if lead_user_id in payload.team_member_user_ids:
            raise HTTPException(status_code=400, detail="The team lead is already included; remove them from team members")
        members = db.query(User.user_id).filter(
            User.user_id.in_(payload.team_member_user_ids), User.is_active.is_(True)
        ).all() if payload.team_member_user_ids else []
        if len(members) != len(payload.team_member_user_ids):
            raise HTTPException(status_code=400, detail="One or more selected team members are inactive or unavailable")

        team_lead = db.query(TeamLead).filter(TeamLead.user_id == lead_user_id).one_or_none()
        if team_lead is None:
            team_lead = TeamLead(user_id=lead_user_id, organization_id=lead_user.organization_id)
            db.add(team_lead)
            db.flush()

        team = Team(
            project_id=project.project_id,
            team_lead_id=team_lead.team_lead_id,
            team_name=f"{project.project_name} Team",
            description=f"Initial delivery team for {project.project_name}.",
            max_members=max(10, len(payload.team_member_user_ids)),
            status="ACTIVE",
        )
        db.add(team)
        db.flush()
        db.add_all(TeamMember(team_id=team.team_id, user_id=user_id) for user_id in payload.team_member_user_ids)
        db.add(Workflow(
            project_id=project.project_id,
            team_lead_id=team_lead.team_lead_id,
            workflow_name=f"{project.project_name} Delivery Workflow"[:100],
            description="Default delivery workflow for this project.",
            workflow_type="Task Workflow",
            is_default=True,
            status="ACTIVE",
        ))

        project_people = {
            actor.user_id,
            lead_user_id,
            manager_user.user_id,
            *payload.team_member_user_ids,
            *_project_calendar_viewers(db, actor.organization_id),
        }
        add_automatic_calendar_entries(
            db,
            project_id=project.project_id,
            actor_id=actor.user_id,
            title=f"Project created: {project.project_name}",
            description=f"{actor.name} created this project and set up its delivery team.",
            event_type="Project",
            personal_user_ids=project_people,
            event_date=project.start_date,
        )
        if project.due_date:
            add_automatic_calendar_entries(
                db,
                project_id=project.project_id,
                actor_id=actor.user_id,
                title=f"Project deadline: {project.project_name}",
                description="Target delivery date for this project.",
                event_type="Deadline",
                personal_user_ids=project_people,
                event_date=project.due_date,
            )
        db.commit()
        db.refresh(project)
    except Exception:
        db.rollback()
        raise
    notify_users(
        db, users_with_permissions(db, "projects.manage"), actor_id=actor.user_id,
        project_id=project.project_id, title=f"Project created: {project.project_name}",
        message=f"{actor.name} created a project.", notification_type="Project Created",
    )
    return project


def update_project(db: Session, project_id: UUID, payload: ProjectUpdate, actor: User) -> Project:
    """Update an existing project, or raise 404."""
    get_project(db, project_id, actor)
    project = repository.update_project(db, project_id, payload)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    add_automatic_calendar_entries(
        db,
        project_id=project_id,
        actor_id=actor.user_id,
        title=f"Project updated: {project.project_name}",
        description=f"{actor.name} updated project information.",
        event_type="Work activity",
        personal_user_ids=project_recipient_ids(db, project_id)
        | _project_calendar_viewers(db, actor.organization_id)
        | {actor.user_id},
    )
    db.commit()
    notify_users(
        db, project_recipient_ids(db, project_id), actor_id=actor.user_id,
        project_id=project_id, title=f"Project updated: {project.project_name}",
        message=f"{actor.name} updated the project details.", notification_type="Project Updated",
    )
    return project


def delete_project(db: Session, project_id: UUID, actor: User) -> None:
    """Delete a project, or raise 404."""
    project = get_project(db, project_id, actor)
    project_name = project.project_name
    recipients = project_recipient_ids(db, project_id)
    deleted = repository.delete_project(db, project_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    notify_users(
        db, recipients, actor_id=actor.user_id, project_id=None,
        title=f"Project deleted: {project_name}",
        message=f"{actor.name} deleted this project.", notification_type="Project Deleted",
    )
