"""Create the RBAC tables and seed the supported actions/default access once."""
from sqlalchemy.orm import Session

from app.core.database import engine
from app.core.permissions import DEFAULT_ROLE_GRANTS, PERMISSION_CATALOG
from app.modules.roles.model import Permission, Role, RolePermission


def initialize_role_permissions() -> None:
    # Import the API module registry so string-based SQLAlchemy relationships
    # declared across all feature modules are registered before ORM queries.
    import app.router  # noqa: F401

    # The project predates Alembic migrations. Create only the new RBAC
    # tables, leaving existing application data and schema untouched.
    Permission.__table__.create(bind=engine, checkfirst=True)
    RolePermission.__table__.create(bind=engine, checkfirst=True)
    db = Session(bind=engine)
    try:
        permissions = {}
        for code, name, description, category in PERMISSION_CATALOG:
            permission = db.query(Permission).filter_by(code=code).one_or_none()
            if permission is None:
                permission = Permission(code=code, name=name, description=description, category=category)
                db.add(permission)
            else:
                permission.name, permission.description, permission.category = name, description, category
            permissions[code] = permission
        db.flush()

        seed_defaults = db.query(RolePermission).count() == 0
        for role_name, permission_codes in DEFAULT_ROLE_GRANTS.items():
            role = db.query(Role).filter_by(role_name=role_name).one_or_none()
            if role is None:
                role = Role(role_name=role_name, description=f"{role_name} role")
                db.add(role)
                db.flush()
            if seed_defaults:
                role.permission_links = [RolePermission(permission=permissions[code]) for code in permission_codes]
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
