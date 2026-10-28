"""Helpers for sending activity notifications to people who can see the work."""

from uuid import UUID

from sqlalchemy.orm import Session

from app.core.logger import logger
from app.modules.notifications.model import Notification
from app.modules.roles.model import Permission, RolePermission, UserRole
from app.modules.teams.model import Team, TeamLead, TeamMember
from app.modules.users.model import User


def project_recipient_ids(db: Session, project_id: UUID) -> set[UUID]:
    """Return project team members and users with project/team management access."""
    member_ids = db.query(TeamMember.user_id).join(Team, Team.team_id == TeamMember.team_id).filter(
        Team.project_id == project_id
    )
    lead_ids = db.query(TeamLead.user_id).join(Team, Team.team_lead_id == TeamLead.team_lead_id).filter(
        Team.project_id == project_id
    )
    manager_ids = db.query(UserRole.user_id).join(
        RolePermission, RolePermission.role_id == UserRole.role_id
    ).join(
        Permission, Permission.permission_id == RolePermission.permission_id
    ).filter(Permission.code.in_(("projects.manage", "teams.manage", "tasks.manage")))
    return {row[0] for row in member_ids.all()} | {
        row[0] for row in lead_ids.all()
    } | {row[0] for row in manager_ids.all()}


def users_with_permissions(db: Session, *codes: str, organization_id: UUID | None = None) -> set[UUID]:
    rows = db.query(UserRole.user_id).join(
        RolePermission, RolePermission.role_id == UserRole.role_id
    ).join(
        Permission, Permission.permission_id == RolePermission.permission_id
    ).join(User, User.user_id == UserRole.user_id).filter(Permission.code.in_(codes))
    if organization_id is not None:
        rows = rows.filter(User.organization_id == organization_id)
    return {row[0] for row in rows.distinct().all()}


def notify_users(
    db: Session,
    user_ids: set[UUID],
    *,
    actor_id: UUID | None,
    project_id: UUID | None,
    title: str,
    message: str,
    notification_type: str,
) -> None:
    """Save one in-app notification per recipient without failing the main action."""
    recipients = user_ids - ({actor_id} if actor_id else set())
    if not recipients:
        return
    try:
        db.add_all(
            Notification(
                user_id=user_id,
                project_id=project_id,
                title=title[:255],
                message=message,
                notification_type=notification_type[:50],
            )
            for user_id in recipients
        )
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Could not save activity notifications for %s", notification_type)


def notify_project_users(
    db: Session,
    project_id: UUID,
    *,
    actor_id: UUID | None,
    title: str,
    message: str,
    notification_type: str,
    additional_user_ids: set[UUID] | None = None,
) -> None:
    recipients = project_recipient_ids(db, project_id)
    if additional_user_ids:
        recipients.update(additional_user_ids)
    notify_users(
        db,
        recipients,
        actor_id=actor_id,
        project_id=project_id,
        title=title,
        message=message,
        notification_type=notification_type,
    )
