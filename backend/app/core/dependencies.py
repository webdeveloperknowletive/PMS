from uuid import UUID

from fastapi import Depends, HTTPException, Request, Security, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from db.session import get_db
from app.modules.auth.service import decode_token
from app.modules.users.model import User

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login",
)


# ==========================================================
# Database Dependency
# ==========================================================

def get_database() -> Session:
    """
    Re-export the database dependency so every module imports
    dependencies.py instead of db.session directly.
    """
    return Depends(get_db)


# ==========================================================
# Authentication Dependencies
# ==========================================================

def get_current_user(
    request: Request,
    token: str = Security(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:

    payload = decode_token(
        token,
        expected_purpose="access",
    )

    user = db.get(
        User,
        UUID(payload["sub"]),
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive account",
        )

    # All subsequent ORM operations in this request are limited to this
    # user's company workspace. Authentication lookup itself happens first.
    db.info["organization_id"] = user.organization_id

    request.state.audit_actor = user.name
    request.state.audit_roles = sorted({assignment.role.role_name for assignment in user.user_roles if assignment.role})
    request.state.audit_organization_id = str(user.organization_id)
    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:

    return current_user


# Authorization is handled by app.core.permissions.require_permission,
# which checks the role grants stored in the database.
