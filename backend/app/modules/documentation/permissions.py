"""
Permissions for the documentation module.

Contributors with the corresponding database permissions may add, edit,
and delete project resources. Everyone authenticated may read.
"""

from fastapi import Depends
from sqlalchemy.orm import Session

from db.session import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenException
from app.core.permissions import has_permission
from app.modules.users.model import User


def can_upload_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Any contributor (Admin / Project Manager / Team Lead / Developer /
    Tester) may upload or update a document.
    """

    if not has_permission(db, current_user, "documents.upload"):
        raise ForbiddenException(message="Missing required permission: documents.upload")

    return current_user


def can_delete_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """
    Deleting resources uses the documents.delete permission.
    """

    if not has_permission(db, current_user, "documents.delete"):
        raise ForbiddenException(message="Missing required permission: documents.delete")

    return current_user


def can_view_documents(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Any authenticated user may read project documents.
    """

    return current_user
