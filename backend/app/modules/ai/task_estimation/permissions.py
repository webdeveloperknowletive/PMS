"""
Permissions for the task estimation AI module.

Triggering an AI generation (which costs LLM tokens and writes AI
output back onto the project) is restricted to delivery leadership;
everyone authenticated may read the results.
"""

from fastapi import Depends
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenException
from app.core.permissions import DELIVERY_LEAD_ROLES, user_has_any_role
from app.modules.users.model import User


def can_generate(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Admin / Project Manager / Team Lead only: generate a new AI task estimation.
    """

    if not user_has_any_role(db, current_user, DELIVERY_LEAD_ROLES):
        raise ForbiddenException(
            message=f"Requires one of the following roles: {', '.join(DELIVERY_LEAD_ROLES)}"
        )

    return current_user


def can_view_results(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Any authenticated user may read AI-generated results.
    """

    return current_user
