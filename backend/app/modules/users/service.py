"""
==========================================================
                USERS SERVICE
==========================================================

Business logic layer for Users. Orchestrates calls to
repository.py and translates "not found" / "duplicate"
into HTTP errors. Routers should only ever call this
layer, never the model or repository directly.
"""

from uuid import UUID
from pathlib import Path
from uuid import uuid4

import bcrypt
from fastapi import HTTPException, UploadFile, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.users import repository
from app.modules.users.model import User
from app.modules.users.schema import UserCreate, UserUpdate
from app.modules.notifications.events import notify_users, users_with_permissions
from app.modules.notifications.events import project_recipient_ids
from app.modules.roles.model import Role, UserRole
from app.modules.teams.model import Team, TeamLead, TeamMember

PROFILE_PICTURE_DIR = Path(__file__).resolve().parents[3] / "uploads" / "profile-pictures"
PROFILE_IMAGE_TYPES = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".webp": "image/webp", ".gif": "image/gif",
}


def _protect_workspace_owner(db: Session, user_id: UUID) -> None:
    """Keep the only account with workspace-owner access from being locked out."""
    is_owner = db.query(UserRole.user_role_id).join(Role, Role.role_id == UserRole.role_id).filter(
        UserRole.user_id == user_id,
        Role.is_system.is_(True),
    ).first()
    if is_owner:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Transfer workspace ownership before deactivating or deleting its owner.",
        )


def _hash_password(plain_password: str) -> str:
    """Hash a user's password."""
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def get_users(db: Session, skip: int = 0, limit: int = 100, include_super_admin: bool = True) -> list[User]:
    """Get paginated users, optionally excluding Super Admin accounts."""
    return repository.get_users(db, skip=skip, limit=limit, include_super_admin=include_super_admin)


def get_user(db: Session, user_id: UUID) -> User:
    """Get a single user by ID, or raise 404."""
    user = repository.get_user(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def create_user(db: Session, payload: UserCreate, actor: User) -> User:
    """
    Create a new user. Raises 409 (not a raw 500) if the email is
    already taken, enforced by the users.email UNIQUE constraint.
    """
    try:
        user = repository.create_user(db, payload, password_hash=_hash_password(payload.password))
        notify_users(db, users_with_permissions(db, "users.manage") | {user.user_id}, actor_id=actor.user_id,
            project_id=None, title=f"User created: {user.name}",
            message=f"{actor.name} created a user account.", notification_type="User Created")
        return user
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A user with this email already exists")


def update_user(db: Session, user_id: UUID, payload: UserUpdate, actor: User) -> User:
    """Update an existing user, or raise 404."""
    if payload.is_active is False:
        _protect_workspace_owner(db, user_id)
    user = repository.update_user(db, user_id, payload)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    notify_users(db, users_with_permissions(db, "users.manage") | {user_id}, actor_id=actor.user_id,
        project_id=None, title=f"User updated: {user.name}",
        message=f"{actor.name} updated the user profile or account details.", notification_type="User Updated")
    return user


def delete_user(db: Session, user_id: UUID, actor: User) -> None:
    """Delete a user, or raise 404."""
    user = get_user(db, user_id)
    _protect_workspace_owner(db, user_id)
    deleted = repository.delete_user(db, user_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    notify_users(db, users_with_permissions(db, "users.manage"), actor_id=actor.user_id,
        project_id=None, title=f"User removed: {user.name}",
        message=f"{actor.name} removed a user account.", notification_type="User Deleted")


def update_user_status(db: Session, user_id: UUID, is_active: bool, actor: User) -> User:
    """Activate or deactivate a user, or raise 404."""
    if not is_active:
        _protect_workspace_owner(db, user_id)
    user = repository.set_user_active_state(db, user_id, is_active)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    notify_users(db, {user_id}, actor_id=actor.user_id, project_id=None,
        title="Account access updated", message=f"{actor.name} {'activated' if is_active else 'deactivated'} your account.",
        notification_type="User Access Updated")
    return user


def change_password(db: Session, user_id: UUID, new_password: str) -> User:
    """Change a user's password, or raise 404."""
    user = repository.update_user_password(db, user_id, password_hash=_hash_password(new_password))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def update_profile(db: Session, user_id: UUID, payload: UserUpdate, actor: User) -> User:
    """Update a user's profile, or raise 404."""
    user = repository.update_user(db, user_id, payload)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if actor.user_id != user_id:
        notify_users(db, {user_id}, actor_id=actor.user_id, project_id=None,
            title="Profile updated", message=f"{actor.name} updated your profile.", notification_type="User Updated")
    return user


def _notify_profile_picture_change(db: Session, user: User, actor: User, action: str) -> None:
    member_projects = db.query(Team.project_id).join(TeamMember, TeamMember.team_id == Team.team_id).filter(
        TeamMember.user_id == user.user_id
    ).all()
    led_projects = db.query(Team.project_id).join(TeamLead, TeamLead.team_lead_id == Team.team_lead_id).filter(
        TeamLead.user_id == user.user_id
    ).all()
    recipients = users_with_permissions(db, "users.manage")
    recipients.add(user.user_id)
    for (project_id,) in member_projects + led_projects:
        recipients.update(project_recipient_ids(db, project_id))
    notify_users(
        db, recipients, actor_id=None, project_id=None,
        title=f"Profile photo {action}: {user.name}",
        message=f"{actor.name} {action} their profile photo." if actor.user_id == user.user_id else f"{actor.name} {action} {user.name}'s profile photo.",
        notification_type="Profile Picture Updated",
    )


async def update_profile_picture(db: Session, user_id: UUID, upload: UploadFile, actor: User) -> User:
    user = get_user(db, user_id)
    original_name = Path((upload.filename or "photo").replace("\\", "/")).name
    suffix = Path(original_name).suffix.lower()
    mime_type = PROFILE_IMAGE_TYPES.get(suffix)
    if mime_type is None:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Choose a JPG, PNG, WEBP, or GIF image.")

    PROFILE_PICTURE_DIR.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid4().hex}{suffix}"
    stored_path = PROFILE_PICTURE_DIR / stored_name
    try:
        with stored_path.open("wb") as destination:
            while chunk := await upload.read(1024 * 1024):
                destination.write(chunk)
        if stored_path.stat().st_size == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choose an image to upload.")
        old_name = user.profile_picture_filename
        user.profile_picture_filename = stored_name
        user.profile_picture_mime_type = mime_type
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        stored_path.unlink(missing_ok=True)
        raise
    if old_name:
        (PROFILE_PICTURE_DIR / Path(old_name).name).unlink(missing_ok=True)
    _notify_profile_picture_change(db, user, actor, "changed")
    return user


def remove_profile_picture(db: Session, user_id: UUID, actor: User) -> User:
    user = get_user(db, user_id)
    old_name = user.profile_picture_filename
    user.profile_picture_filename = None
    user.profile_picture_mime_type = None
    db.commit()
    db.refresh(user)
    if old_name:
        (PROFILE_PICTURE_DIR / Path(old_name).name).unlink(missing_ok=True)
    _notify_profile_picture_change(db, user, actor, "removed")
    return user


def get_profile_picture_path(db: Session, user_id: UUID) -> tuple[Path, str]:
    user = get_user(db, user_id)
    if not user.profile_picture_filename:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No profile photo is set.")
    path = PROFILE_PICTURE_DIR / Path(user.profile_picture_filename).name
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile photo is missing.")
    return path, user.profile_picture_mime_type or "application/octet-stream"
