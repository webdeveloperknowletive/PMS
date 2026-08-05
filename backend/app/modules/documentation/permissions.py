"""
Permissions for the documentation module.

Any contributor may upload/update project documents; deleting one is
restricted to delivery leadership. Everyone authenticated may read.
"""

from fastapi import Depends
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenException
from app.core.permissions import CONTRIBUTOR_ROLES, DELIVERY_LEAD_ROLES, user_has_any_role
from app.modules.users.model import User


def can_upload_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Any contributor (Admin / Project Manager / Team Lead / Developer /
    Tester) may upload or update a document.
    """

    if not user_has_any_role(db, current_user, CONTRIBUTOR_ROLES):
        raise ForbiddenException(
            message=f"Requires one of the following roles: {', '.join(CONTRIBUTOR_ROLES)}"
        )

    return current_user


def can_delete_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Admin / Project Manager / Team Lead only: delete a document.
    """

    if not user_has_any_role(db, current_user, DELIVERY_LEAD_ROLES):
        raise ForbiddenException(
            message=f"Requires one of the following roles: {', '.join(DELIVERY_LEAD_ROLES)}"
        )

    return current_user


def can_view_documents(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Any authenticated user may read project documents.
    """

    return current_user
