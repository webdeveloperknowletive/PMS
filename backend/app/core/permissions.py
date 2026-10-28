"""Workspace-scoped, database-backed authorization for API actions."""

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from uuid import UUID as UUIDType

from db.session import get_db
from app.core.config import API_V1_PREFIX
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenException
from app.modules.roles.model import Permission, RolePermission, UserPermission, UserRole
from app.modules.users.model import User


# This is the capability catalog for actions the API supports. Roles and their
# grants are stored in the database and can be configured by workspace admins.
_RESOURCES: dict[str, tuple[str, tuple[str, ...]]] = {
    "organizations": ("Organization", ("view", "update")),
    "invitations": ("Invitations", ("view", "create", "update", "delete", "resend")),
    "users": ("Users", ("view", "create", "update", "delete", "status.update", "password.update")),
    "users.permissions": ("User permissions", ("view", "update")),
    "users.profile": ("User profile", ("view", "update")),
    "users.profile_picture": ("Profile picture", ("view", "upload", "delete")),
    "roles": ("Roles", ("view", "create", "update", "delete", "manage")),
    "roles.assignments": ("Role assignments", ("view", "create", "delete")),
    "roles.permissions": ("Role permissions", ("view", "update")),
    "projects": ("Projects", ("view", "create", "update", "delete")),
    "teams": ("Teams", ("view", "create", "update", "delete")),
    "teams.leads": ("Team leads", ("view", "create", "delete")),
    "teams.members": ("Team members", ("view", "create", "update", "delete")),
    "tasks": ("Tasks", ("view", "create", "update", "update_assigned", "delete")),
    "tasks.sprints": ("Sprints", ("view", "create", "update", "delete")),
    "tasks.comments": ("Task comments", ("view", "create")),
    "tasks.activity": ("Task activity", ("view",)),
    "kanban.card_labels": ("Kanban card labels", ("update",)),
    "kanban.labels": ("Kanban label catalog", ("manage",)),
    "kanban.card_dates": ("Kanban card dates", ("update",)),
    "kanban.card_checklists": ("Kanban card checklists", ("update",)),
    "kanban.card_checklists.items": ("Checklist item details", ("manage",)),
    "kanban.card_attachments": ("Kanban card attachments", ("view", "upload", "delete")),
    "kanban.cards": ("Kanban cards", ("create", "details.update", "archive", "restore", "members.manage")),
    "tasks.subtasks": ("Subtasks", ("view",)),
    "tasks.work_sessions": ("Work sessions", ("view", "start", "stop")),
    "tasks.work_time": ("Work time", ("view",)),
    "workflow": ("Workflows", ("view", "create", "update", "delete")),
    "kanban.columns": ("Kanban columns", ("view", "create", "update", "delete")),
    "kanban.tasks": ("Kanban cards", ("view", "create", "update", "delete", "move")),
    "gantt": ("Gantt schedules", ("view", "create", "update", "delete")),
    "milestones": ("Milestones", ("view", "create", "update", "delete")),
    "calendar": ("Calendar events", ("view", "create", "update", "delete")),
    "documents": ("Documents", ("view", "create", "update", "delete", "upload", "download")),
    "notifications": ("Notifications", ("view", "create", "update", "delete")),
    "notifications.settings": ("Notification settings", ("view", "update")),
    "notifications.personal_settings": ("Personal notification settings", ("view", "update")),
    "chat.contacts": ("Chat contacts", ("view",)),
    "chat.conversations": ("Chat conversations", ("view", "create", "update")),
    "chat.groups": ("Chat groups", ("create",)),
    "chat.members": ("Chat members", ("update",)),
    "chat.messages": ("Chat messages", ("view", "create", "delete")),
    "chat.attachments": ("Chat attachments", ("view", "upload")),
    "chat.reactions": ("Chat reactions", ("create",)),
    "chat.settings": ("Chat settings", ("view", "update")),
    "chat.organization_settings": ("Organization chat settings", ("view", "update")),
    "reports": ("Reports", ("view", "create", "update", "delete")),
    "ai.sprint_plans": ("AI sprint plans", ("view", "generate", "create", "update", "delete")),
    "ai.risk_predictions": ("AI risk predictions", ("view", "generate", "create", "update", "delete")),
    "ai.documentation": ("AI documentation", ("view", "generate", "create")),
    "ai.task_estimations": ("AI task estimations", ("view", "generate", "create", "update", "delete")),
    "ai.meeting_summaries": ("AI meeting summaries", ("view", "generate", "create", "update", "delete")),
}


PERMISSION_CATALOG = [
    (f"{resource}.{action}",
     "Kanban cards: Manage members" if resource == "kanban.cards" and action == "members.manage" else
     "Checklist item details: Manage" if resource == "kanban.card_checklists.items" else
     f"{label}: {action.replace('.', ' ').replace('_', ' ').title()}",
     "Allow users to add or remove members from Kanban cards." if resource == "kanban.cards" and action == "members.manage" else
     "Allow users to assign checklist item members and due dates." if resource == "kanban.card_checklists.items" else
     f"Allow {action.replace('.', ' ').replace('_', ' ')} for {label.lower()}.",
     label)
    for resource, (label, actions) in _RESOURCES.items()
    for action in actions
]
PERMISSION_CODES = {row[0] for row in PERMISSION_CATALOG}


# Compatibility for checks in older module-level guards. Route-level
# authorization below still checks the exact action, so these aliases cannot
# turn one CRUD grant into access to the other CRUD endpoints.
LEGACY_PERMISSION_ALIASES: dict[str, tuple[str, ...]] = {
    "organization.manage": ("organizations.update",),
    "invitations.manage": tuple(f"invitations.{a}" for a in ("view", "create", "update", "delete", "resend")),
    "users.manage": tuple(f"users.{a}" for a in ("create", "update", "delete", "status.update", "password.update")),
    "roles.manage": ("roles.manage",),
    # Grant editors need to read the catalog and current selection to avoid
    # clearing permissions when they only have the update capability.
    "roles.permissions.view": ("roles.permissions.view", "roles.permissions.update"),
    "users.permissions.view": ("users.permissions.view", "users.permissions.update"),
    "projects.manage": tuple(f"projects.{a}" for a in ("create", "update", "delete")),
    "teams.manage": tuple(f"teams.{a}" for a in ("create", "update", "delete")) + ("teams.leads.create", "teams.leads.delete"),
    "teams.members.manage": tuple(f"teams.members.{a}" for a in ("view", "create", "update", "delete")),
    "tasks.manage": tuple(f"tasks.{a}" for a in ("create", "update", "delete")) +
                    tuple(f"tasks.sprints.{a}" for a in ("create", "update", "delete")),
    "tasks.team_view": ("tasks.view",),
    "tasks.update_assigned": ("tasks.update_assigned",),
    "workflow.manage": tuple(f"workflow.{a}" for a in ("create", "update", "delete")),
    "kanban.manage": tuple(f"kanban.columns.{a}" for a in ("create", "update", "delete")) + ("kanban.tasks.create", "kanban.tasks.delete"),
    "kanban.move": ("kanban.tasks.move",),
    "gantt.manage": tuple(f"gantt.{a}" for a in ("create", "update", "delete")),
    "milestones.manage": tuple(f"milestones.{a}" for a in ("create", "update", "delete")),
    "documents.upload": ("documents.upload",),
    "documents.delete": ("documents.delete",),
    "calendar.create": ("calendar.create",),
    "calendar.manage": ("calendar.update", "calendar.delete"),
    "reports.manage": tuple(f"reports.{a}" for a in ("create", "update", "delete")),
    "ai.use": tuple(f"{resource}.generate" for resource in _RESOURCES if resource.startswith("ai.")),
    "ai.view": tuple(f"{resource}.view" for resource in _RESOURCES if resource.startswith("ai.")),
}
for _resource in ("projects", "teams", "tasks", "workflow", "gantt", "milestones", "documents", "calendar", "reports", "notifications"):
    LEGACY_PERMISSION_ALIASES[f"{_resource}.view"] = (f"{_resource}.view",)
LEGACY_PERMISSION_ALIASES["kanban.view"] = ("kanban.columns.view", "kanban.tasks.view")
LEGACY_PERMISSION_ALIASES["tasks.comments.view"] = ("tasks.comments.view", "tasks.comments.create")
LEGACY_PERMISSION_ALIASES["kanban.cards.create"] = (
    "kanban.cards.create", "kanban.tasks.create", "tasks.create", "tasks.update", "tasks.delete", "roles.manage",
)
LEGACY_PERMISSION_ALIASES["kanban.cards.details.update"] = ("kanban.cards.details.update", "tasks.update", "roles.manage")
LEGACY_PERMISSION_ALIASES["kanban.cards.archive"] = ("kanban.cards.archive", "kanban.tasks.delete", "kanban.manage", "roles.manage")
LEGACY_PERMISSION_ALIASES["kanban.cards.restore"] = ("kanban.cards.restore", "kanban.manage", "roles.manage")
LEGACY_PERMISSION_ALIASES["kanban.cards.members.manage"] = ("kanban.cards.members.manage", "roles.manage")
LEGACY_PERMISSION_ALIASES["kanban.card_checklists.items.manage"] = ("kanban.card_checklists.items.manage", "roles.manage")
LEGACY_PERMISSION_ALIASES["kanban.labels.manage"] = ("kanban.labels.manage", "roles.manage")
# Team dashboards need the read-only team/lead relationships when grants are
# assigned at the granular members/leads level.
LEGACY_PERMISSION_ALIASES["teams.view"] = ("teams.view", "teams.members.view", "teams.leads.view")
LEGACY_PERMISSION_ALIASES["teams.leads.view"] = ("teams.leads.view", "teams.members.view", "teams.view")
LEGACY_PERMISSION_ALIASES["kanban.card_attachments.view"] = (
    "kanban.card_attachments.view", "kanban.card_attachments.upload", "kanban.card_attachments.delete",
    "tasks.update", "tasks.update_assigned", "roles.manage",
)
for _feature_permission in (
    "kanban.card_labels.update", "kanban.card_dates.update", "kanban.card_checklists.update",
    "kanban.card_attachments.upload", "kanban.card_attachments.delete",
):
    LEGACY_PERMISSION_ALIASES[_feature_permission] = (_feature_permission, "tasks.update", "tasks.update_assigned", "roles.manage")


def _action_for_method(method: str) -> str:
    return {"GET": "view", "POST": "create", "PUT": "update", "PATCH": "update", "DELETE": "delete"}.get(method.upper(), "")


def permission_code_for_request(request: Request) -> str | None:
    """Resolve each API route to the catalog permission that protects it."""
    route = request.scope.get("route")
    path = getattr(route, "path", request.url.path)
    prefix = API_V1_PREFIX.rstrip("/")
    if path.startswith(prefix + "/"):
        path = path[len(prefix) + 1:]
    parts = [part for part in path.strip("/").split("/") if part]
    if not parts:
        return None
    module = parts[0]
    tail = parts[1:]
    method = request.method.upper()
    action = _action_for_method(method)

    # Authentication and invitation bootstrap/acceptance are public or have
    # their own identity and token checks. Permission introspection is needed
    # by every signed-in client to render the RBAC-controlled UI.
    if module == "auth":
        return ""
    if module == "organizations" and (tail == ["register"] or tail[:1] == ["accept"] or tail[:2] == ["invitations", "accept"] or tail[:2] == ["invitations", "preview"]):
        return ""
    if module == "roles" and (tail[:2] == ["me", "permissions"] or tail[:1] == ["users"] and len(tail) == 2):
        return ""

    if module == "organizations":
        if tail and tail[0] == "invitations":
            if len(tail) > 1 and tail[1] == "preview":
                return ""
            return f"invitations.{('resend' if len(tail) > 2 and tail[2] == 'resend' else action)}" if (len(tail) > 2 and tail[2] == "resend") else f"invitations.{action}"
        return f"organizations.{action}"
    if module == "roles":
        if tail and tail[0] == "permissions":
            return f"roles.permissions.{action}"
        if tail and tail[0] == "assignments":
            return "roles.assignments.view"
        if tail and tail[0] == "users":
            return f"roles.assignments.{('create' if method == 'POST' else 'delete')}"
        if len(tail) > 1 and tail[1] == "permissions":
            return f"roles.permissions.{('view' if method == 'GET' else 'update')}"
        return f"roles.{action}"
    if module == "audit-logs":
        return "roles.manage"
    if module == "search":
        return "tasks.view"
    if module == "ai":
        resource_key = {
            "sprint-plans": "sprint_plans", "risk-predictions": "risk_predictions",
            "documentation": "documentation", "task-estimations": "task_estimations",
            "meeting-summaries": "meeting_summaries",
        }.get(tail[0] if tail else "")
        if resource_key:
            resource = f"ai.{resource_key}"
            if len(tail) > 1 and tail[1] == "generate":
                return f"{resource}.generate"
            if resource_key == "documentation" and len(tail) > 1 and tail[1] == "save":
                return f"{resource}.create"
            return f"{resource}.{action}"
    if module == "users":
        if tail[:2] == ["permissions", "catalog"]:
            return "users.permissions.view"
        if len(tail) > 1 and tail[1] == "permissions":
            return f"users.permissions.{('view' if method == 'GET' else 'update')}"
        if len(tail) > 1 and tail[1] == "profile":
            return f"users.profile.{action}"
        if len(tail) > 1 and tail[1] == "password":
            return "users.password.update"
        if len(tail) > 1 and tail[1] == "profile-picture":
            return f"users.profile_picture.{'view' if method == 'GET' else 'upload' if method == 'PUT' else 'delete'}"
        return f"users.{action}"
    if module == "teams" and tail:
        if tail[0] == "leads":
            return f"teams.leads.{action}"
        if "members" in tail:
            return f"teams.members.{action}"
    if module == "tasks" and tail:
        if tail[:2] == ["deadline-reminders", "check"]:
            return "tasks.view"
        if "checklist-member-options" in tail:
            return "kanban.card_checklists.items.manage"
        if "card-labels" in tail:
            return "kanban.card_labels.update"
        if "card-dates" in tail:
            return "kanban.card_dates.update"
        if "card-checklist" in tail:
            return "kanban.card_checklists.update"
        if "attachments" in tail:
            if method == "POST":
                return "kanban.card_attachments.upload"
            if method == "DELETE":
                return "kanban.card_attachments.delete"
            return "kanban.card_attachments.view"
        if tail[0] == "saved-filters":
            return "tasks.view"
        resource = tail[0].replace("-", "_")
        if resource in {"work_sessions", "work_time", "sprints", "comments", "activity", "subtasks"}:
            if resource == "work_sessions" and len(tail) > 1 and tail[1] in {"start", "stop"}:
                return f"tasks.work_sessions.{tail[1]}"
            return f"tasks.{resource}.{action}"
        if len(tail) > 1 and tail[1] in {"comments", "activity", "subtasks"}:
            return f"tasks.{tail[1]}.{action}"
    if module == "kanban" and tail:
        if tail[0] == "labels":
            return "kanban.tasks.view" if method == "GET" else "kanban.labels.manage"
        if tail[0] == "cards":
            if len(tail) > 2 and tail[2] in {"members", "member-options"}:
                return "kanban.cards.members.manage"
            if len(tail) > 1 and tail[1] == "archived":
                return "kanban.tasks.view"
            if len(tail) > 2 and tail[2] in {"archive", "restore"}:
                return f"kanban.cards.{tail[2]}"
            if len(tail) > 1 and tail[1] not in {"archived"}:
                return "kanban.cards.details.update" if method in {"PUT", "PATCH"} else f"kanban.cards.{action}"
            return "kanban.cards.create" if method == "POST" else "kanban.tasks.view"
        resource = "columns" if tail[0] == "columns" else "tasks"
        if resource == "tasks" and ("move" in tail or "approve-review" in tail or "cancel-review" in tail):
            return "kanban.tasks.move"
        return f"kanban.{resource}.{action}"
    if module == "documentation":
        if tail and tail[0] == "upload":
            return "documents.upload"
        if "download" in tail:
            return "documents.download"
        return f"documents.{action}"
    if module == "notifications" and tail and tail[0] == "settings":
        if len(tail) > 1 and tail[1] == "volume":
            return f"notifications.personal_settings.{action}"
        return f"notifications.settings.{action}"
    if module == "chat" and tail:
        if tail[0] == "contacts": return "chat.contacts.view"
        if tail[0] == "settings":
            resource = "chat.organization_settings" if len(tail) > 1 and tail[1] == "organization" else "chat.settings"
            return f"{resource}.{action}"
        if tail[0] == "groups": return "chat.groups.create"
        if tail[0] == "direct": return "chat.conversations.create"
        if "members" in tail: return f"chat.members.{action}"
        if "attachments" in tail or "attachment" in tail: return f"chat.attachments.{'upload' if method == 'POST' else 'view'}"
        if "reactions" in tail: return "chat.reactions.create"
        if "messages" in tail: return f"chat.messages.{action}"
        if tail[0] == "conversations": return f"chat.conversations.{action}"
    resource = {"documentation": "documents", "workflows": "workflow"}.get(module, module)
    code = f"{resource}.{action}"
    return code if code in PERMISSION_CODES else None


def has_permission(db: Session, user: User, code: str) -> bool:
    candidates = LEGACY_PERMISSION_ALIASES.get(code, (code,))
    # One explicit permission can delegate complete RBAC administration.
    if code.startswith("roles.") and code != "roles.manage":
        candidates = (*candidates, "roles.manage")
    if code == "tasks.update":
        candidates = (*candidates, "tasks.update_assigned")
    if code == "projects.view":
        # Workspace administrators may read any project in their own tenant.
        candidates = (*candidates, "roles.manage")
    from_role = db.query(RolePermission.role_id).join(
        UserRole, UserRole.role_id == RolePermission.role_id
    ).join(
        Permission, Permission.permission_id == RolePermission.permission_id
    ).filter(
        UserRole.user_id == user.user_id,
        Permission.code.in_(candidates),
    ).first() is not None
    if from_role:
        return True
    return db.query(UserPermission.user_permission_id).join(
        Permission, Permission.permission_id == UserPermission.permission_id
    ).filter(
        UserPermission.user_id == user.user_id,
        Permission.code.in_(candidates),
    ).first() is not None


def has_role(db: Session, user: User, role_name: str) -> bool:
    """Compatibility helper for display or legacy call sites."""
    from app.modules.roles.model import Role
    user_id = getattr(user, "user_id", user)
    return db.query(UserRole.user_role_id).join(Role, Role.role_id == UserRole.role_id).filter(
        UserRole.user_id == user_id, Role.role_name == role_name,
    ).first() is not None


def is_system_role_assigned(db: Session, user: User) -> bool:
    from app.modules.roles.model import Role
    return db.query(UserRole.user_role_id).join(Role, Role.role_id == UserRole.role_id).filter(
        UserRole.user_id == user.user_id, Role.is_system.is_(True),
    ).first() is not None


def get_user_permission_codes(db: Session, user: User) -> list[str]:
    role_codes = {row[0] for row in db.query(Permission.code).join(
        RolePermission, Permission.permission_id == RolePermission.permission_id
    ).join(
        UserRole, UserRole.role_id == RolePermission.role_id
    ).filter(UserRole.user_id == user.user_id).distinct().all()}
    direct_codes = {row[0] for row in db.query(Permission.code).join(
        UserPermission, Permission.permission_id == UserPermission.permission_id
    ).filter(UserPermission.user_id == user.user_id).distinct().all()}
    return sorted(role_codes | direct_codes)


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


async def authorize_api_action(
    request: Request,
    db: Session = Depends(get_db),
) -> User | None:
    code = permission_code_for_request(request)
    if code == "":
        return None
    if code is None:
        route = request.scope.get("route")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"No permission is registered for API action '{getattr(route, 'name', request.url.path)}'.",
        )
    if code not in PERMISSION_CODES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"No permission is configured for '{code}'.")
    authorization = request.headers.get("authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    current_user = get_current_user(request=request, token=token, db=db)
    project_id = await _project_id_for_request(request, db)
    is_assigned_work_session_start = False
    if code == "tasks.work_sessions.start" and request.method == "POST" and (
        has_permission(db, current_user, "tasks.update_assigned")
        or has_permission(db, current_user, "tasks.manage")
        or has_permission(db, current_user, "kanban.move")
    ):
        try:
            body = await request.json()
            raw_task_ids = body.get("task_ids", []) if isinstance(body, dict) else []
            task_ids = {UUIDType(str(task_id)) for task_id in raw_task_ids}
        except (TypeError, ValueError):
            task_ids = set()
        if task_ids:
            from app.modules.tasks.model import Task
            assigned_count = db.query(Task.task_id).filter(
                Task.task_id.in_(task_ids),
                Task.organization_id == current_user.organization_id,
                Task.user_id == current_user.user_id,
            ).count()
            is_assigned_work_session_start = assigned_count == len(task_ids)
    is_assigned_team_lead_create = False
    if code == "teams.create" and request.method == "POST" and project_id is not None and has_permission(db, current_user, "teams.members.manage"):
        from app.modules.teams.model import Team, TeamLead
        is_assigned_team_lead_create = db.query(Team.team_id).join(
            TeamLead, Team.team_lead_id == TeamLead.team_lead_id
        ).filter(Team.project_id == project_id, TeamLead.user_id == current_user.user_id).first() is not None
    can_read_assigned_project = False
    if code == "projects.view" and request.method == "GET" and request.url.path.startswith(f"{API_V1_PREFIX}/projects"):
        from app.modules.projects.model import Project
        from app.modules.teams.model import Team, TeamLead, TeamMember

        assigned = db.query(Project.project_id).filter(Project.project_manager_user_id == current_user.user_id)
        lead_assignment = db.query(Team.project_id).join(
            TeamLead, Team.team_lead_id == TeamLead.team_lead_id
        ).filter(TeamLead.user_id == current_user.user_id)
        member_assignment = db.query(Team.project_id).join(
            TeamMember, TeamMember.team_id == Team.team_id
        ).filter(TeamMember.user_id == current_user.user_id)
        requested_project = request.path_params.get("project_id")
        if requested_project:
            assigned = assigned.filter(Project.project_id == UUIDType(str(requested_project)))
            lead_assignment = lead_assignment.filter(Team.project_id == UUIDType(str(requested_project)))
            member_assignment = member_assignment.filter(Team.project_id == UUIDType(str(requested_project)))
        can_read_assigned_project = bool(assigned.first() or lead_assignment.first() or member_assignment.first())
    is_kanban_task_data_read = (
        request.method == "GET"
        and code in {"tasks.view", "tasks.work_sessions.view", "tasks.work_time.view"}
        and has_permission(db, current_user, "kanban.view")
    )
    is_authorized_task_reminder_check = (
        request.method == "POST"
        and request.url.path.endswith("/tasks/deadline-reminders/check")
        and any(has_permission(db, current_user, permission) for permission in (
            "tasks.view", "tasks.team_view", "tasks.manage", "tasks.update",
            "tasks.update_assigned", "kanban.view", "kanban.move", "roles.manage",
        ))
    )
    is_assigned_kanban_card_detail_update = False
    if code == "kanban.cards.details.update" and request.method == "PATCH" and has_permission(db, current_user, "tasks.update_assigned"):
        from app.modules.tasks.model import Task
        task_id = request.path_params.get("task_id")
        if task_id:
            try:
                parsed_task_id = UUIDType(str(task_id))
            except (TypeError, ValueError):
                parsed_task_id = None
            if parsed_task_id is not None:
                is_assigned_kanban_card_detail_update = db.query(Task.task_id).filter(
                    Task.task_id == parsed_task_id,
                    Task.organization_id == current_user.organization_id,
                    Task.user_id == current_user.user_id,
                ).first() is not None
    is_assigned_review_approver = False
    if request.method == "POST" and request.url.path.endswith(("/approve-review", "/cancel-review")) and "task_id" in request.path_params:
        from app.modules.projects.model import Project
        from app.modules.tasks.model import Task
        from app.modules.teams.model import Team, TeamLead

        task = db.query(Task).filter(Task.task_id == UUIDType(str(request.path_params["task_id"]))).one_or_none()
        if task is not None and task.project_id == project_id:
            is_assigned_review_approver = db.query(Project.project_id).filter(
                Project.project_id == task.project_id,
                Project.project_manager_user_id == current_user.user_id,
            ).first() is not None
            if not is_assigned_review_approver and request.url.path.endswith("/approve-review") and task.team_id:
                is_assigned_review_approver = db.query(Team.team_id).join(
                    TeamLead, TeamLead.team_lead_id == Team.team_lead_id
                ).filter(Team.team_id == task.team_id, TeamLead.user_id == current_user.user_id).first() is not None
    is_assigned_project_manager_kanban_move = False
    kanban_path = request.url.path.split(API_V1_PREFIX.rstrip("/") + "/", 1)[-1].strip("/").split("/")
    is_card_move_request = (
        request.method == "PUT" and len(kanban_path) == 3 and kanban_path[:2] == ["kanban", "tasks"]
    ) or (
        request.method == "PATCH" and len(kanban_path) == 4 and kanban_path[:2] == ["kanban", "tasks"] and kanban_path[-1] == "move"
    )
    if code == "kanban.tasks.move" and is_card_move_request and project_id is not None:
        from app.modules.projects.model import Project

        is_assigned_project_manager_kanban_move = db.query(Project.project_id).filter(
            Project.project_id == project_id,
            Project.project_manager_user_id == current_user.user_id,
            Project.organization_id == current_user.organization_id,
        ).first() is not None
    if not has_permission(db, current_user, code) and not can_read_assigned_project and not is_assigned_team_lead_create and not is_assigned_work_session_start and not is_kanban_task_data_read and not is_authorized_task_reminder_check and not is_assigned_review_approver and not is_assigned_project_manager_kanban_move and not is_assigned_kanban_card_detail_update:
        raise ForbiddenException(message=f"Missing required permission: {code}")
    if project_id is not None and not has_permission(db, current_user, "roles.manage"):
        from app.modules.projects.model import Project

        manager_id = db.query(Project.project_manager_user_id).filter(Project.project_id == project_id).scalar()
        if manager_id is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        if request.method not in {"POST", "PUT", "PATCH", "DELETE"}:
            # Users with project-management grants are limited to projects
            # explicitly assigned to them. Other contributors can read only
            # project data visible through their assigned teams or membership.
            if manager_id != current_user.user_id:
                from app.modules.tasks.repository import get_visible_project_ids
                if project_id not in get_visible_project_ids(db, current_user.user_id):
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
            return current_user
        from app.modules.teams.model import Team, TeamLead
        is_project_team_lead = db.query(Team.team_id).join(
            TeamLead, Team.team_lead_id == TeamLead.team_lead_id
        ).filter(Team.project_id == project_id, TeamLead.user_id == current_user.user_id).first() is not None
        is_team_lead_for_row = False
        if "team_id" in request.path_params:
            is_team_lead_for_row = db.query(Team.team_id).join(
                TeamLead, Team.team_lead_id == TeamLead.team_lead_id
            ).filter(Team.team_id == UUIDType(str(request.path_params["team_id"])), TeamLead.user_id == current_user.user_id).first() is not None
        may_manage_own_team_membership = is_team_lead_for_row and "/members" in request.url.path
        may_view_own_team = is_team_lead_for_row and request.method == "GET"
        may_update_own_team = (
            is_team_lead_for_row
            and request.method in {"PUT", "PATCH"}
            and code == "teams.update"
            and request.url.path.rstrip("/").endswith(f"/teams/{request.path_params.get('team_id')}")
        )
        may_delete_own_team = is_team_lead_for_row and code == "teams.delete" and request.method == "DELETE"
        is_team_creation = request.method == "POST" and request.url.path.rstrip("/").endswith("/teams")
        is_team_lead_task_action = is_project_team_lead and request.url.path.startswith(f"{API_V1_PREFIX}/tasks")
        is_permitted_kanban_card_action = (
            request.url.path.startswith(f"{API_V1_PREFIX}/kanban/cards")
            and code.startswith("kanban.cards.")
            and has_permission(db, current_user, code)
        )
        is_permitted_task_card_feature_action = (
            request.url.path.startswith(f"{API_V1_PREFIX}/tasks/")
            and code.startswith("kanban.card_")
            and has_permission(db, current_user, code)
        )
        is_team_lead_team_create = is_project_team_lead and is_team_creation
        is_team_lead_review_approval = (
            is_project_team_lead
            and code == "kanban.tasks.move"
            and request.method == "POST"
            and request.url.path.endswith("/approve-review")
        )
        is_team_member = False
        if request.url.path.startswith(f"{API_V1_PREFIX}/kanban/"):
            from app.modules.teams.model import TeamMember
            is_team_member = db.query(TeamMember.member_id).join(Team, Team.team_id == TeamMember.team_id).filter(
                Team.project_id == project_id, TeamMember.user_id == current_user.user_id
            ).first() is not None
            is_board_structure_change = "/columns" in request.url.path or (
                "/tasks" in request.url.path and request.method in {"POST", "DELETE"}
            )
            if is_team_member and not is_project_team_lead and manager_id != current_user.user_id and is_board_structure_change:
                raise ForbiddenException(message="Team members can move their assigned cards but cannot create or delete board items")
        is_member_kanban_move = False
        if request.method == "PATCH" and request.url.path.endswith("/move") and "task_id" in request.path_params:
            from app.modules.kanban.model import KanbanTask
            from app.modules.tasks.model import Task
            is_member_kanban_move = db.query(KanbanTask.kanban_task_id).join(
                Task, Task.task_id == KanbanTask.task_id
            ).filter(KanbanTask.kanban_task_id == UUIDType(str(request.path_params["task_id"])), Task.user_id == current_user.user_id).first() is not None
        if manager_id != current_user.user_id and not (
            may_manage_own_team_membership or may_view_own_team or may_update_own_team or may_delete_own_team or is_team_lead_team_create
            or is_team_lead_task_action or is_team_lead_review_approval or is_member_kanban_move or is_permitted_kanban_card_action or is_permitted_task_card_feature_action or is_assigned_kanban_card_detail_update
        ):
            raise ForbiddenException(message="Only the assigned Project Manager can manage this project's data")
    return current_user


async def _project_id_for_request(request: Request, db: Session):
    """Resolve the project touched by a project-scoped request, if any."""
    from uuid import UUID as UUIDType

    def parse(value):
        if value is None:
            return None
        try:
            return UUIDType(str(value))
        except (TypeError, ValueError):
            return None

    params = request.path_params
    project_id = parse(params.get("project_id") or request.query_params.get("project_id"))
    if project_id is None and request.method in {"POST", "PUT", "PATCH"}:
        content_type = request.headers.get("content-type", "")
        try:
            if "application/json" in content_type:
                body = await request.json()
                if isinstance(body, dict):
                    project_id = parse(body.get("project_id"))
            elif "multipart/form-data" in content_type:
                form = await request.form()
                project_id = parse(form.get("project_id"))
        except Exception:
            project_id = None
    if project_id is not None:
        return project_id

    path = request.url.path
    prefix = API_V1_PREFIX.rstrip("/") + "/"
    if path.startswith(prefix):
        path = path[len(prefix):]
    segments = [segment for segment in path.strip("/").split("/") if segment]
    if not segments:
        return None
    module = segments[0]
    row_id = None
    if module == "projects":
        return parse(params.get("project_id"))
    if module == "teams" and "team_id" in params and "leads" not in segments:
        from app.modules.teams.model import Team
        row = db.query(Team.project_id).filter(Team.team_id == parse(params.get("team_id"))).scalar()
        return row
    if module == "tasks":
        from app.modules.tasks.model import Task, TaskSprint
        if "sprint_id" in params:
            row_id, id_field = params["sprint_id"], TaskSprint.sprint_id
        elif "task_id" in params:
            row_id, id_field = params["task_id"], Task.task_id
        else:
            return None
        model = TaskSprint if "sprint_id" in params else Task
        return db.query(model.project_id).filter(id_field == parse(row_id)).scalar()
    if module == "workflow" or module == "workflows":
        from app.modules.workflow.model import Workflow
        if "workflow_id" in params:
            return db.query(Workflow.project_id).filter(Workflow.workflow_id == parse(params["workflow_id"])).scalar()
    if module == "kanban":
        from app.modules.kanban.model import KanbanColumn, KanbanTask
        if len(segments) > 1 and segments[1] == "cards" and "task_id" in params:
            from app.modules.tasks.model import Task
            return db.query(Task.project_id).filter(Task.task_id == parse(params.get("task_id"))).scalar()
        if "column_id" in params:
            return db.query(KanbanColumn.project_id).filter(KanbanColumn.column_id == parse(params["column_id"])).scalar()
        if "task_id" in params:
            if request.url.path.endswith(("/approve-review", "/cancel-review")):
                from app.modules.tasks.model import Task
                return db.query(Task.project_id).filter(Task.task_id == parse(params["task_id"])).scalar()
            return db.query(KanbanColumn.project_id).join(KanbanTask, KanbanTask.column_id == KanbanColumn.column_id).filter(
                KanbanTask.kanban_task_id == parse(params["task_id"])
            ).scalar()
    if module == "gantt" and "gantt_id" in params:
        from app.modules.gantt.model import GanttTask
        return db.query(GanttTask.project_id).filter(GanttTask.gantt_id == parse(params["gantt_id"])).scalar()
    if module == "milestones" and "milestone_id" in params:
        from app.modules.milestones.model import Milestone
        return db.query(Milestone.project_id).filter(Milestone.milestone_id == parse(params["milestone_id"])).scalar()
    if module == "documentation" and "document_id" in params:
        from app.modules.documentation.model import Document
        return db.query(Document.project_id).filter(Document.document_id == parse(params["document_id"])).scalar()
    if module == "calendar" and "event_id" in params:
        from app.modules.calendar.model import CalendarEvent
        return db.query(CalendarEvent.project_id).filter(CalendarEvent.event_id == parse(params["event_id"])).scalar()
    if module == "reports" and "report_id" in params:
        from app.modules.reports.model import Report
        return db.query(Report.project_id).filter(Report.report_id == parse(params["report_id"])).scalar()
    if module == "ai":
        ai_models = {
            "sprint-plans": ("sprint_plan_id", "app.modules.ai.sprint_planning.model", "AISprintPlan"),
            "risk-predictions": ("prediction_id", "app.modules.ai.risk_prediction.model", "AIRiskPrediction"),
            "task-estimations": ("estimation_id", "app.modules.ai.task_estimation.model", "AITaskEstimation"),
            "meeting-summaries": ("summary_id", "app.modules.ai.meeting_summary.model", "AIMeetingSummary"),
            "documentation": ("document_generation_id", "app.modules.ai.doc_generator.model", "AIDocumentGeneration"),
        }
        if len(segments) > 1 and segments[1] in ai_models:
            id_name, module_name, class_name = ai_models[segments[1]]
            if id_name in params:
                import importlib
                ai_model = getattr(importlib.import_module(module_name), class_name)
                return db.query(ai_model.project_id).filter(getattr(ai_model, id_name) == parse(params[id_name])).scalar()
    return None
