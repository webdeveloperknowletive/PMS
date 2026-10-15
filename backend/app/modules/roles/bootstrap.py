"""Ensure each workspace's action catalog and owner role exist."""

from sqlalchemy.orm import Session

from app.core.database import engine
from app.core.permissions import PERMISSION_CATALOG
from app.modules.organizations.model import Organization
from app.modules.roles.model import Permission, Role, RolePermission


def initialize_role_permissions() -> None:
    # Register string-based ORM relationships before using the models.
    import app.router  # noqa: F401

    db = Session(bind=engine)
    try:
        for organization in db.query(Organization).all():
            db.info["organization_id"] = organization.organization_id
            permissions: dict[str, Permission] = {}
            for code, name, description, category in PERMISSION_CATALOG:
                permission = db.query(Permission).filter_by(code=code).one_or_none()
                if permission is None:
                    permission = Permission(code=code, name=name, description=description, category=category)
                    db.add(permission)
                else:
                    permission.name = name
                    permission.description = description
                    permission.category = category
                permissions[code] = permission
            db.flush()

            system_roles = db.query(Role).filter(Role.is_system.is_(True)).all()
            if not system_roles:
                root = Role(role_name="Workspace Owner", description="Workspace owner", is_system=True)
                db.add(root)
                system_roles = [root]
            for role in system_roles:
                existing_ids = {link.permission_id for link in db.query(RolePermission).filter_by(role_id=role.role_id).all()}
                db.add_all(
                    RolePermission(role_id=role.role_id, permission_id=permission.permission_id)
                    for permission in permissions.values()
                    if permission.permission_id not in existing_ids
                )
            db.flush()
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
