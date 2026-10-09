"""Database-backed permission checks shared by all API modules."""
from fastapi import Depends
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenException
from app.modules.roles.model import Permission, RolePermission, UserRole
from app.modules.users.model import User


# This is the list of actions the application knows how to perform. Admins
# assign these actions to roles in the database; role names have no special
# access meaning in request authorization.
PERMISSION_CATALOG = [
    ("users.manage", "Manage users", "Create, update, deactivate and remove users", "Administration"),
    ("roles.manage", "Manage roles and access", "Create roles and assign permissions or roles", "Administration"),
    ("projects.manage", "Manage projects", "Create, edit and delete projects", "Projects"),
    ("teams.manage", "Manage teams", "Create, edit and delete teams", "Teams"),
    ("teams.members.manage", "Manage team members", "Add or remove team members", "Teams"),
    ("tasks.manage", "Manage all tasks", "Create, assign, edit and delete tasks", "Tasks"),
    ("tasks.update_assigned", "Update assigned tasks", "Update tasks assigned to you", "Tasks"),
    ("workflow.manage", "Manage workflows", "Create and update workflow statuses", "Workflow"),
    ("kanban.manage", "Manage boards", "Create boards and manage board columns", "Kanban"),
    ("kanban.move", "Move task cards", "Move cards between board columns", "Kanban"),
    ("gantt.manage", "Manage schedules", "Edit project schedule and dependencies", "Planning"),
    ("milestones.manage", "Manage milestones", "Create and update project milestones", "Planning"),
    ("documents.upload", "Upload documents", "Upload project documents", "Collaboration"),
    ("documents.delete", "Delete documents", "Delete project documents", "Collaboration"),
    ("calendar.create", "Create calendar events", "Create calendar events", "Collaboration"),
    ("calendar.manage", "Manage all calendar events", "Edit or delete any calendar event", "Collaboration"),
    ("reports.manage", "Manage reports", "Create and manage reports", "Reports"),
    ("ai.use", "Use AI tools", "Run available AI assistance tools", "AI tools"),
]

DEFAULT_ROLE_GRANTS = {
    "Admin": {row[0] for row in PERMISSION_CATALOG},
    "Project Manager": {"projects.manage", "teams.manage", "teams.members.manage", "tasks.manage", "workflow.manage", "kanban.manage", "kanban.move", "gantt.manage", "milestones.manage", "documents.upload", "documents.delete", "calendar.create", "calendar.manage", "reports.manage", "ai.use"},
    "Team Lead": {"teams.members.manage", "tasks.manage", "workflow.manage", "kanban.manage", "kanban.move", "gantt.manage", "milestones.manage", "documents.upload", "documents.delete", "calendar.create", "calendar.manage", "reports.manage", "ai.use"},
    "Developer": {"tasks.update_assigned", "kanban.move", "documents.upload", "documents.delete", "calendar.create"},
    "Tester": {"tasks.update_assigned", "kanban.move", "documents.upload", "documents.delete", "calendar.create"},
    "Viewer": set(),
}


def has_permission(db: Session, user: User, code: str) -> bool:
    return db.query(RolePermission.role_id).join(UserRole, UserRole.role_id == RolePermission.role_id).join(
        Permission, Permission.permission_id == RolePermission.permission_id
    ).filter(UserRole.user_id == user.user_id, Permission.code == code).first() is not None


def get_user_permission_codes(db: Session, user: User) -> list[str]:
    return [
        row[0]
        for row in db.query(Permission.code)
        .join(RolePermission, Permission.permission_id == RolePermission.permission_id)
        .join(UserRole, UserRole.role_id == RolePermission.role_id)
        .filter(UserRole.user_id == user.user_id)
        .distinct()
        .all()
    ]


def require_permission(code: str):
    def check(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
        if not has_permission(db, current_user, code):
            raise ForbiddenException(message=f"Missing required permission: {code}")
        return current_user
    return check


def require_any_permission(*codes: str):
    def check(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
        if not any(has_permission(db, current_user, code) for code in codes):
            raise ForbiddenException(message=f"Requires one of these permissions: {', '.join(codes)}")
        return current_user
    return check


class PermissionChecker:
    def __init__(self, permission_codes):
        self.permission_codes = list(permission_codes)

    def __call__(self, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
        if not any(has_permission(db, current_user, code) for code in self.permission_codes):
            raise ForbiddenException(message=f"Requires one of these permissions: {', '.join(self.permission_codes)}")
        return current_user


def require_any_role(*codes):
    return PermissionChecker(codes)


def require_admin():
    return require_permission("roles.manage")
