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
import re

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload, selectinload

from app.modules.projects import repository
from app.modules.projects.model import Project, ProjectTemplate
from app.modules.projects.schema import ProjectAssignmentCandidateRead, ProjectAssignmentRead, ProjectCreate, ProjectUpdate
from app.modules.notifications.events import notify_users, project_recipient_ids, users_with_permissions
from app.modules.users.model import User
from app.modules.roles.model import Permission, RolePermission, UserRole
from app.modules.kanban.constants import DEFAULT_COLUMN_COLORS, DEFAULT_COLUMN_NAMES
from app.modules.kanban.model import KanbanColumn
from app.modules.teams.model import Team, TeamLead, TeamMember
from app.modules.tasks.model import Task
from app.modules.workflow.model import Workflow
from app.modules.calendar.automatic import add_automatic_calendar_entries
from app.core.permissions import has_permission


def get_project_assignment_candidates(db: Session, current_user: User) -> list[ProjectAssignmentCandidateRead]:
    """Return active team leads and developers for project setup."""
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
        if any(role.strip().casefold() in {"team lead", "developer"} for role in role_names):
            results.append(ProjectAssignmentCandidateRead(
                user_id=user.user_id,
                name=user.name,
                role_names=role_names,
                is_active=user.is_active,
            ))
    return results


def get_project_assignment(db: Session, project_id: UUID, current_user: User) -> ProjectAssignmentRead:
    if has_permission(db, current_user, "projects.manage"):
        project = repository.get_project(db, project_id, organization_id=current_user.organization_id)
        if project is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    else:
        project = get_project(db, project_id, current_user)
        if project.project_manager_user_id != current_user.user_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    team = db.query(Team).filter(Team.project_id == project_id).order_by(Team.created_at.asc()).first()
    if team is None:
        return ProjectAssignmentRead()
    return ProjectAssignmentRead(
        team_id=team.team_id,
        team_lead_user_id=team.team_lead.user_id,
        team_member_user_ids=[member.user_id for member in team.members],
    )


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
        "team_lead_user_id", "team_member_user_ids", "board_template", "project_template_id",
        "project_manager_user_id",
    }
    try:
        board_template = payload.board_template
        if payload.project_template_id is not None:
            saved_template = db.query(ProjectTemplate).filter(
                ProjectTemplate.template_id == payload.project_template_id,
                ProjectTemplate.organization_id == actor.organization_id,
            ).one_or_none()
            if saved_template is None:
                raise HTTPException(status_code=404, detail="Project template not found")
            board_template = saved_template.board_template
        project_data = payload.model_dump(exclude=setup_fields)
        project_key_base = _project_key_base(payload.project_name)
        existing_keys = {
            key.upper() for (key,) in db.query(Project.project_key).filter(
                Project.organization_id == actor.organization_id,
            ).all()
        }
        project_key = project_key_base
        suffix = 2
        while project_key.upper() in existing_keys:
            suffix_text = str(suffix)
            project_key = f"{project_key_base[:12 - len(suffix_text)]}{suffix_text}"
            suffix += 1
        project = Project(
            **project_data,
            project_manager_user_id=payload.project_manager_user_id or actor.user_id,
            project_key=project_key,
            organization_id=actor.organization_id,
        )
        db.add(project)
        db.flush()

        board_template_columns = {
            "STANDARD": DEFAULT_COLUMN_NAMES,
            "SIMPLE": ("To Do", "In Progress", "Done"),
            "BLOCKED": ("To Do", "In Progress", "In Review", "Blocked", "Done"),
        }[board_template]
        db.add_all(
            KanbanColumn(
                project_id=project.project_id,
                column_name=name,
                position=position,
                color=DEFAULT_COLUMN_COLORS.get(name),
            )
            for position, name in enumerate(board_template_columns)
        )

        lead_user_id = payload.team_lead_user_id
        lead_user = db.query(User).filter(
            User.user_id == lead_user_id,
            User.organization_id == actor.organization_id,
            User.is_active.is_(True),
        ).one_or_none()
        if lead_user is None or not any(role.strip().casefold() == "team lead" for role in lead_user.role_names):
            raise HTTPException(status_code=400, detail="Choose an active user with the Team Lead role")
        if payload.project_manager_user_id:
            manager_user = db.query(User).filter(
                User.user_id == payload.project_manager_user_id,
                User.organization_id == actor.organization_id,
                User.is_active.is_(True),
            ).one_or_none()
            if manager_user is None or not any(role.strip().casefold() == "project manager" for role in manager_user.role_names):
                raise HTTPException(status_code=400, detail="Choose an active user with the Project Manager role")
        else:
            # Without a separate manager selection, keep the creator able to
            # open and manage the project they just created.
            manager_user = actor
        if lead_user_id in payload.team_member_user_ids:
            raise HTTPException(status_code=400, detail="The team lead is already included; remove them from team members")
        members = db.query(User).options(
            selectinload(User.user_roles).joinedload(UserRole.role)
        ).filter(
            User.user_id.in_(payload.team_member_user_ids),
            User.organization_id == actor.organization_id,
            User.is_active.is_(True),
        ).all() if payload.team_member_user_ids else []
        if len(members) != len(payload.team_member_user_ids):
            raise HTTPException(status_code=400, detail="One or more selected team members are inactive or unavailable")
        developer_ids = {
            member.user_id for member in members
            if any(role.strip().casefold() == "developer" for role in member.role_names)
        }
        if developer_ids != set(payload.team_member_user_ids):
            raise HTTPException(status_code=400, detail="Team members must be active developers in this organization")

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
    project_team_recipients = {lead_user_id, manager_user.user_id, *payload.team_member_user_ids}
    notification_message = f"{actor.name} created project {project.project_name}."
    notify_users(
        db, project_team_recipients,
        actor_id=actor.user_id,
        project_id=project.project_id, title=f"Project created: {project.project_name}",
        message=notification_message, notification_type="Project Created",
    )
    workspace_managers = users_with_permissions(
        db, "projects.manage", organization_id=actor.organization_id
    ) - project_team_recipients
    notify_users(
        db, workspace_managers,
        actor_id=actor.user_id,
        project_id=project.project_id, title=f"Project created: {project.project_name}",
        message=notification_message, notification_type="Project Created",
    )
    return project


def _project_key_base(project_name: str) -> str:
    words = re.findall(r"[A-Za-z0-9]+", project_name.upper())
    if not words:
        return "PROJ"
    key = "".join(word[0] for word in words[:6]) if len(words) > 1 else words[0][:4]
    return (key or "PROJ")[:12]


def update_project(db: Session, project_id: UUID, payload: ProjectUpdate, actor: User) -> Project:
    """Update an existing project, or raise 404."""
    current_project = get_project(db, project_id, actor)
    values = payload.model_dump(exclude_unset=True)
    start_date = values.get("start_date", current_project.start_date)
    due_date = values.get("due_date", current_project.due_date)
    if start_date and due_date and due_date < start_date:
        raise HTTPException(status_code=400, detail="Due date must be on or after the start date")
    if start_date is not None and start_date != current_project.start_date:
        earlier_task = db.query(Task.task_id).filter(
            Task.organization_id == actor.organization_id,
            Task.project_id == project_id,
            Task.due_date.is_not(None),
            Task.due_date < start_date,
        ).first()
        if earlier_task:
            raise HTTPException(status_code=400, detail="Project start date cannot be after an existing task due date")
    assignment_fields = {"team_lead_user_id", "team_member_user_ids"}
    assignment_changed = bool(assignment_fields & payload.model_fields_set)
    ordinary_values = payload.model_dump(exclude_unset=True, exclude=assignment_fields)
    for field, value in ordinary_values.items():
        setattr(current_project, field, value)

    assignment_team = None
    if assignment_changed:
        assignment_team = db.query(Team).filter(Team.project_id == project_id).order_by(Team.created_at.asc()).first()
        lead_user_id = payload.team_lead_user_id
        if lead_user_id is None and assignment_team is not None:
            lead_user_id = assignment_team.team_lead.user_id
        if lead_user_id is None:
            raise HTTPException(status_code=400, detail="Choose a Team Lead for this project")
        lead_user = db.query(User).options(
            selectinload(User.user_roles).joinedload(UserRole.role)
        ).filter(
            User.user_id == lead_user_id,
            User.organization_id == actor.organization_id,
            User.is_active.is_(True),
        ).one_or_none()
        if lead_user is None or not any(role.strip().casefold() == "team lead" for role in lead_user.role_names):
            raise HTTPException(status_code=400, detail="Choose an active user with the Team Lead role")

        member_ids = payload.team_member_user_ids
        if member_ids is None:
            member_ids = [member.user_id for member in assignment_team.members] if assignment_team else []
        if lead_user_id in member_ids:
            raise HTTPException(status_code=400, detail="The Team Lead cannot also be listed as a Developer")
        members = db.query(User).options(
            selectinload(User.user_roles).joinedload(UserRole.role)
        ).filter(
            User.user_id.in_(member_ids),
            User.organization_id == actor.organization_id,
            User.is_active.is_(True),
        ).all() if member_ids else []
        if len(members) != len(member_ids) or any(
            not any(role.strip().casefold() == "developer" for role in member.role_names)
            for member in members
        ):
            raise HTTPException(status_code=400, detail="Team members must be active developers in this organization")

        team_lead = db.query(TeamLead).filter(TeamLead.user_id == lead_user_id).one_or_none()
        if team_lead is None:
            team_lead = TeamLead(user_id=lead_user_id, organization_id=actor.organization_id)
            db.add(team_lead)
            db.flush()
        if assignment_team is None:
            assignment_team = Team(
                project_id=project_id,
                team_lead_id=team_lead.team_lead_id,
                team_name=f"{current_project.project_name} Team",
                description=f"Initial delivery team for {current_project.project_name}.",
                max_members=max(10, len(member_ids)),
                status="ACTIVE",
                organization_id=actor.organization_id,
            )
            db.add(assignment_team)
            db.flush()
        else:
            assignment_team.team_lead_id = team_lead.team_lead_id
        assignment_team.max_members = max(assignment_team.max_members, len(member_ids))
        desired_ids = set(member_ids)
        existing_ids = {membership.user_id for membership in assignment_team.members}
        for membership in list(assignment_team.members):
            if membership.user_id not in desired_ids:
                db.delete(membership)
        db.add_all(
            TeamMember(team_id=assignment_team.team_id, user_id=user_id, organization_id=actor.organization_id)
            for user_id in desired_ids - existing_ids
        )

    project = current_project
    db.flush()
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
    db.refresh(project)
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
