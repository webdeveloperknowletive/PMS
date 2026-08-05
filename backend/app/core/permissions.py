"""
Core RBAC permission engine.

This module holds the role vocabulary and the reusable FastAPI dependency
that every module's own `permissions.py` builds on top of. It intentionally
mirrors the role names already used by `app.core.dependencies.require_role`
(`Admin`, `Project Manager`, `Team Lead`, `Developer`, `Tester`, `Viewer`)
so the two layers never drift apart.
"""

from fastapi import Depends
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenException
from app.modules.roles.model import UserRole
from app.modules.users.model import User


# ==========================================================
# Role Name Constants
# ==========================================================

ROLE_ADMIN = "Admin"
ROLE_PROJECT_MANAGER = "Project Manager"
ROLE_TEAM_LEAD = "Team Lead"
ROLE_DEVELOPER = "Developer"
ROLE_TESTER = "Tester"
ROLE_VIEWER = "Viewer"

ALL_ROLES = (
    ROLE_ADMIN,
    ROLE_PROJECT_MANAGER,
    ROLE_TEAM_LEAD,
    ROLE_DEVELOPER,
    ROLE_TESTER,
    ROLE_VIEWER,
)

# Roles that manage projects/teams/workflows end to end.
MANAGEMENT_ROLES = (
    ROLE_ADMIN,
    ROLE_PROJECT_MANAGER,
)

# Roles that lead day-to-day delivery work within a team.
DELIVERY_LEAD_ROLES = (
    ROLE_ADMIN,
    ROLE_PROJECT_MANAGER,
    ROLE_TEAM_LEAD,
)

# Roles that actively produce work (as opposed to only reviewing/viewing it).
CONTRIBUTOR_ROLES = (
    ROLE_ADMIN,
    ROLE_PROJECT_MANAGER,
    ROLE_TEAM_LEAD,
    ROLE_DEVELOPER,
    ROLE_TESTER,
)

# Roles that may only read data by default.
READ_ONLY_ROLES = (ROLE_VIEWER,)


# ==========================================================
# Role Lookup Helpers
# ==========================================================

def get_user_role_names(
    db: Session,
    user: User,
) -> list[str]:
    """
    Return the `role_name` of every role assigned to `user`.
    """

    assignments = (
        db.query(UserRole)
        .filter(UserRole.user_id == user.user_id)
        .all()
    )

    return [
        assignment.role.role_name
        for assignment in assignments
        if assignment.role is not None
    ]


def user_has_role(
    db: Session,
    user: User,
    role_name: str,
) -> bool:

    return role_name in get_user_role_names(db, user)


def user_has_any_role(
    db: Session,
    user: User,
    role_names,
) -> bool:

    allowed = set(role_names)

    return bool(allowed.intersection(get_user_role_names(db, user)))


def is_admin(
    db: Session,
    user: User,
) -> bool:

    return user_has_role(db, user, ROLE_ADMIN)


# ==========================================================
# Permission Dependency
# ==========================================================

class PermissionChecker:
    """
    FastAPI dependency that only allows access to users holding at least
    one of `allowed_roles`. Admins always pass, regardless of the roles
    they were instantiated with.

    Usage:
        @router.post(
            "/",
            dependencies=[Depends(PermissionChecker([ROLE_ADMIN, ROLE_PROJECT_MANAGER]))],
        )
    """

    def __init__(self, allowed_roles):
        self.allowed_roles = list(allowed_roles)

    def __call__(
        self,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:

        user_roles = get_user_role_names(db, current_user)

        if ROLE_ADMIN in user_roles:
            return current_user

        if not set(self.allowed_roles).intersection(user_roles):
            raise ForbiddenException(
                message=f"Requires one of the following roles: {', '.join(self.allowed_roles)}"
            )

        return current_user


def require_any_role(*role_names):
    """
    Functional shortcut for `PermissionChecker`.

    Usage:
        Depends(require_any_role(ROLE_ADMIN, ROLE_PROJECT_MANAGER))
    """

    return PermissionChecker(role_names)


def require_admin():

    return PermissionChecker([ROLE_ADMIN])
