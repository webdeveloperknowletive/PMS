"""Ensure each workspace's action catalog and owner role exist."""

from sqlalchemy.orm import Session

from app.core.database import engine
from app.core.permissions import PERMISSION_CATALOG, WORKSPACE_MODULE_ACTIONS
from app.modules.organizations.model import Organization
from app.modules.roles.model import Permission, Role, RolePermission


DEFAULT_EMPLOYEE_ROLES = (
    ("Admin", "Workspace administrator"),
    ("Project Manager", "Project delivery manager"),
    ("Team Lead", "Team delivery lead"),
    ("Developer", "Development team member"),
    ("Tester", "Quality assurance team member"),
    ("Viewer", "Read-only workspace member"),
)


def backfill_role_module_access(db: Session, organization_id, role_ids=None) -> None:
    """Derive initial module grants from existing action grants without changing them."""
    permissions = {
        item.code: item for item in db.query(Permission).filter(Permission.organization_id == organization_id).all()
    }
    roles_query = db.query(Role).filter(Role.organization_id == organization_id)
    if role_ids is not None:
        roles_query = roles_query.filter(Role.role_id.in_(role_ids))
    roles = roles_query.all()
    for role in roles:
        granted = {row[0] for row in db.query(Permission.code).join(
            RolePermission, RolePermission.permission_id == Permission.permission_id
        ).filter(RolePermission.role_id == role.role_id).all()}
        target_codes = {"modules.dashboard.access"}
        for module, action_codes in WORKSPACE_MODULE_ACTIONS.items():
            # Profile and profile-picture permissions are self-service APIs,
            # not access to the workspace-wide Users directory.
            module_grants = action_codes
            if module == "users":
                module_grants = tuple(
                    code for code in action_codes
                    if not code.startswith(("users.profile.", "users.profile_picture."))
                )
            if module != "dashboard" and granted.intersection(module_grants):
                target_codes.add(f"modules.{module}.access")
        existing = {row[0] for row in db.query(Permission.code).join(
            RolePermission, RolePermission.permission_id == Permission.permission_id
        ).filter(RolePermission.role_id == role.role_id).all()}
        db.add_all(
            RolePermission(organization_id=organization_id, role_id=role.role_id, permission_id=permissions[code].permission_id)
            for code in target_codes - existing if code in permissions
        )


def ensure_employee_roles(db: Session, organization_id) -> None:
    """Ensure every workspace has selectable, non-system employee roles.

    Older workspaces were created with only the system owner role. Invitations
    cannot grant that role, so those workspaces otherwise render an empty role
    selector. Keep this idempotent and leave custom role changes untouched.
    """
    permissions = {
        permission.code: permission
        for permission in db.query(Permission).filter(Permission.organization_id == organization_id).all()
    }
    created_role_ids = []
    all_codes = {code for code in permissions if not code.startswith("modules.")}

    def select(*, prefixes=(), exact=(), exclude=()):
        """Build a role's initial action grants from the workspace catalog."""
        return {
            code for code in all_codes
            if (code in exact or any(code.startswith(prefix) for prefix in prefixes))
            and code not in exclude
        }

    def exclude_codes(*prefixes):
        return {code for code in all_codes if any(code.startswith(prefix) for prefix in prefixes)}

    ai_without_delete = {
        code for code in all_codes
        if code.startswith("ai.") and not code.endswith(".delete")
    }
    ai_view_create_generate = {
        code for code in all_codes
        if code.startswith("ai.") and code.rsplit(".", 1)[-1] in {"view", "create", "generate"}
    }
    profile_view = {"users.profile.view", "users.profile_picture.view"}
    role_permissions = {
        "Admin": all_codes,
        "Project Manager": select(
            prefixes=("tasks.", "teams.", "milestones.", "calendar.", "documents.", "workflow.", "kanban.", "gantt."),
            exact=("projects.view", "projects.update", "reports.view", "reports.create", "notifications.view"),
        ) | ai_without_delete | profile_view | {
            "notifications.personal_settings.view", "notifications.personal_settings.update",
        },
        "Team Lead": select(
            prefixes=("kanban.", "teams.members.", "ai."),
            exact=(
                "projects.view", "tasks.activity.view", "tasks.comments.view", "tasks.comments.create",
                "tasks.create", "tasks.sprints.view", "tasks.subtasks.view", "tasks.update",
                "tasks.update_assigned", "tasks.view", "tasks.work_sessions.start", "tasks.work_sessions.stop",
                "tasks.work_sessions.view", "tasks.work_time.view", "teams.view", "teams.leads.view",
                "milestones.view", "milestones.update", "calendar.view", "calendar.create",
                "documents.view", "documents.create", "documents.upload", "documents.download",
                "workflow.view", "gantt.view", "reports.view", "notifications.view",
                "notifications.personal_settings.view", "notifications.personal_settings.update",
            ),
            exclude=exclude_codes("ai.") - ai_view_create_generate | {
                "kanban.card_attachments.delete", "kanban.tasks.delete",
            },
        ) | profile_view,
        "Developer": select(
            prefixes=("ai.",),
            exact=(
                "projects.view", "tasks.activity.view", "tasks.comments.view", "tasks.comments.create",
                "tasks.sprints.view", "tasks.subtasks.view", "tasks.update_assigned", "tasks.view",
                "tasks.work_sessions.start", "tasks.work_sessions.stop", "tasks.work_sessions.view", "tasks.work_time.view",
                "teams.view", "teams.leads.view", "teams.members.view", "calendar.view",
                "documents.view", "documents.create", "documents.upload", "documents.download",
                "gantt.view", "kanban.card_attachments.view", "kanban.card_attachments.upload",
                "kanban.columns.view", "kanban.tasks.view", "kanban.tasks.move", "milestones.view",
                "notifications.view", "notifications.personal_settings.view", "notifications.personal_settings.update",
                "reports.view", "workflow.view",
            ),
            exclude=exclude_codes("ai.") - ai_view_create_generate,
        ) | profile_view,
        "Tester": select(
            prefixes=("ai.",),
            exact=(
                "projects.view", "tasks.activity.view", "tasks.comments.view", "tasks.comments.create",
                "tasks.sprints.view", "tasks.subtasks.view", "tasks.update_assigned", "tasks.view",
                "tasks.work_sessions.start", "tasks.work_sessions.stop", "tasks.work_sessions.view", "tasks.work_time.view",
                "teams.view", "teams.leads.view", "teams.members.view", "calendar.view",
                "documents.view", "documents.create", "documents.upload", "documents.download",
                "gantt.view", "kanban.card_attachments.view", "kanban.card_attachments.upload",
                "kanban.columns.view", "kanban.tasks.view", "kanban.tasks.move", "milestones.view",
                "notifications.view", "notifications.personal_settings.view", "notifications.personal_settings.update",
                "reports.view", "workflow.view",
            ),
            exclude=exclude_codes("ai.") - ai_view_create_generate,
        ) | profile_view,
        "Viewer": select(
            exact=(
                "projects.view", "tasks.activity.view", "tasks.comments.view", "tasks.sprints.view",
                "tasks.subtasks.view", "tasks.view", "tasks.work_sessions.view", "tasks.work_time.view",
                "teams.view", "teams.leads.view", "teams.members.view", "calendar.view", "documents.view",
                "gantt.view", "kanban.card_attachments.view", "kanban.columns.view", "kanban.tasks.view",
                "milestones.view", "notifications.view", "notifications.settings.view",
                "notifications.personal_settings.view", "notifications.personal_settings.update",
                "reports.view", "workflow.view",
            ),
        ),
    }
    for role_name, description in DEFAULT_EMPLOYEE_ROLES:
        created_role = False
        role = db.query(Role).filter(
            Role.organization_id == organization_id,
            Role.role_name == role_name,
        ).one_or_none()
        if role is None:
            role = Role(
                organization_id=organization_id,
                role_name=role_name,
                description=description,
                is_system=False,
            )
            db.add(role)
            db.flush()
            created_role_ids.append(role.role_id)
            created_role = True
        existing_ids = {
            link.permission_id
            for link in db.query(RolePermission).filter(RolePermission.role_id == role.role_id).all()
        }
        if created_role:
            db.add_all(
                RolePermission(
                    organization_id=organization_id,
                    role_id=role.role_id,
                    permission_id=permissions[code].permission_id,
                )
                for code in role_permissions[role_name]
                if code in permissions and permissions[code].permission_id not in existing_ids
            )
    db.flush()
    if created_role_ids:
        backfill_role_module_access(db, organization_id, created_role_ids)


def initialize_role_permissions() -> None:
    # Register string-based ORM relationships before using the models.
    import app.router  # noqa: F401

    db = Session(bind=engine)
    try:
        for organization in db.query(Organization).all():
            db.info["organization_id"] = organization.organization_id
            needs_module_backfill = db.query(Permission.permission_id).filter(
                Permission.organization_id == organization.organization_id,
                Permission.code == "modules.dashboard.access",
            ).first() is None
            permissions: dict[str, Permission] = {}
            for code, name, description, category in PERMISSION_CATALOG:
                permission = db.query(Permission).filter_by(code=code).one_or_none()
                if permission is None:
                    permission = Permission(
                        organization_id=organization.organization_id,
                        code=code,
                        name=name,
                        description=description,
                        category=category,
                    )
                    db.add(permission)
                else:
                    permission.name = name
                    permission.description = description
                    permission.category = category
                permissions[code] = permission
            db.flush()

            system_roles = []
            for role_name, description in (
                ("Super Admin", "Platform administrator"),
                ("Workspace Owner", "Workspace owner"),
            ):
                role = db.query(Role).filter(
                    Role.organization_id == organization.organization_id,
                    Role.role_name == role_name,
                    Role.is_system.is_(True),
                ).one_or_none()
                if role is None:
                    role = Role(
                        organization_id=organization.organization_id,
                        role_name=role_name,
                        description=description,
                        is_system=True,
                    )
                    db.add(role)
                    db.flush()
                system_roles.append(role)
            for role in system_roles:
                existing_ids = {link.permission_id for link in db.query(RolePermission).filter_by(role_id=role.role_id).all()}
                db.add_all(
                    RolePermission(
                        organization_id=organization.organization_id,
                        role_id=role.role_id,
                        permission_id=permission.permission_id,
                    )
                    for permission in permissions.values()
                    if permission.permission_id not in existing_ids
                )
            db.flush()
            ensure_employee_roles(db, organization.organization_id)
            if needs_module_backfill:
                backfill_role_module_access(db, organization.organization_id)
            # Flush before switching the session's workspace context on the
            # next loop iteration; pending role grants belong to this tenant.
            db.flush()
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
