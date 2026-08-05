from uuid import UUID

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from db.session import get_db
from app.modules.auth.service import decode_token
from app.modules.users.model import User
from app.modules.roles.model import UserRole

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login",
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

    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:

    return current_user


# ==========================================================
# Role Dependencies
# ==========================================================

def require_role(
    role_name: str,
):

    def dependency(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):

        assignment = (
            db.query(UserRole)
            .filter(
                UserRole.user_id == current_user.user_id,
            )
            .first()
        )

        if assignment is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No role assigned",
            )

        role = assignment.role

        if role is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Role not found",
            )

        if role.role_name != role_name:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permission denied",
            )

        return current_user

    return dependency


# ==========================================================
# Permission Dependencies
# ==========================================================

def require_admin():

    return require_role("Admin")


def require_project_manager():

    return require_role("Project Manager")


def require_team_lead():

    return require_role("Team Lead")


def require_developer():

    return require_role("Developer")


def require_tester():

    return require_role("Tester")


def require_viewer():

    return require_role("Viewer")