import hashlib
import secrets
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import delete, func, select
from app.core.database import Base
from sqlalchemy.exc import IntegrityError

from app.core.config import invitation_app_url
from app.core.email import send_workspace_invitation
from app.modules.organizations import service as organizations
from app.modules.organizations.model import Organization, OrganizationInvitation, OrganizationSubscription
from app.modules.platform.model import PlatformAdmin, PlatformAuditEvent
from app.modules.roles.model import Role
from app.modules.teams.model import Team
from app.modules.users.model import User
from app.modules.workflow.model import Workflow


@contextmanager
def platform_scope(db):
    previous = db.info.pop("organization_id", None)
    try:
        yield
    except Exception:
        db.rollback()
        raise
    finally:
        db.info.pop("organization_id", None)
        if previous is not None:
            db.info["organization_id"] = previous


def lock_workspace(db, organization_id):
    workspace = db.query(Organization).filter(Organization.organization_id == organization_id).with_for_update().one_or_none()
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


def audit(db, admin, workspace, action):
    db.add(PlatformAuditEvent(platform_admin_id=admin.platform_admin_id, organization_id=workspace.organization_id, workspace_slug=workspace.slug, action=action))


def validate_slug(db, slug, except_id=None):
    if slug in organizations.RESERVED_SLUGS:
        raise HTTPException(status_code=422, detail="Choose a different workspace address")
    query = db.query(Organization).filter(Organization.slug == slug)
    if except_id is not None:
        query = query.filter(Organization.organization_id != except_id)
    if query.first():
        raise HTTPException(status_code=409, detail="That workspace address is already taken")


def send_owner_setup(workspace, invitation, raw_token):
    try:
        return send_workspace_invitation(invitation.email, workspace.name, invitation_app_url(workspace.slug, raw_token), organizations.INVITATION_EXPIRE_HOURS, inviter_name="SprintIX platform administration")
    except HTTPException:
        return False


def create_workspace(db, admin, payload):
    with platform_scope(db):
        validate_slug(db, payload.slug)
        email = str(payload.owner_email).lower()
        if (db.query(User).filter(func.lower(User.email) == email).first()
                or db.query(PlatformAdmin).filter(func.lower(PlatformAdmin.email) == email).first()):
            raise HTTPException(status_code=409, detail="This email already has an account. Use a new owner email.")
        pending_owner = db.query(OrganizationInvitation).filter(
            func.lower(OrganizationInvitation.email) == email,
            OrganizationInvitation.invited_by_user_id.is_(None),
            OrganizationInvitation.accepted_at.is_(None), OrganizationInvitation.revoked_at.is_(None),
        ).first()
        if pending_owner:
            raise HTTPException(status_code=409, detail="This owner already has a pending workspace setup. Open that workspace to resend the setup email.")
        workspace, owner_role = organizations.initialize_workspace(db, payload.name, payload.slug)
        raw_token = secrets.token_urlsafe(32)
        invitation = OrganizationInvitation(organization_id=workspace.organization_id, role_id=owner_role.role_id,
            email=email, invited_by_user_id=None, token_hash=hashlib.sha256(raw_token.encode()).hexdigest(),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=organizations.INVITATION_EXPIRE_HOURS))
        db.add(invitation)
        audit(db, admin, workspace, "CREATE")
        try:
            db.commit()
        except IntegrityError:
            raise HTTPException(status_code=409, detail="That workspace address was just taken.")
        # Commit first: the owner can safely retry delivery if SMTP is unavailable.
        return {"organization_id": workspace.organization_id, "email_sent": send_owner_setup(workspace, invitation, raw_token)}


def update_workspace(db, admin, organization_id, payload):
    with platform_scope(db):
        workspace = lock_workspace(db, organization_id)
        validate_slug(db, payload.slug, workspace.organization_id)
        workspace.name = payload.name
        workspace.slug = payload.slug
        audit(db, admin, workspace, "UPDATE")
        try:
            db.commit()
        except IntegrityError:
            raise HTTPException(status_code=409, detail="That workspace address was just taken.")
        return {"organization_id": workspace.organization_id, "name": workspace.name, "slug": workspace.slug}


def set_status(db, admin, organization_id, status):
    if status not in {"ACTIVE", "SUSPENDED"}:
        raise HTTPException(status_code=422, detail="Invalid workspace status")
    with platform_scope(db):
        workspace = lock_workspace(db, organization_id)
        if workspace.status != status:
            workspace.status = status
            audit(db, admin, workspace, "SUSPEND" if status == "SUSPENDED" else "REACTIVATE")
            db.commit()
        return {"organization_id": workspace.organization_id, "status": workspace.status}


def resend_owner_setup(db, admin, organization_id):
    with platform_scope(db):
        workspace = lock_workspace(db, organization_id)
        if workspace.status != "ACTIVE":
            raise HTTPException(status_code=409, detail="Reactivate this workspace before sending owner setup.")
        invitation = db.query(OrganizationInvitation).join(Role, Role.role_id == OrganizationInvitation.role_id).filter(
            OrganizationInvitation.organization_id == workspace.organization_id,
            Role.role_name == "Workspace Owner", OrganizationInvitation.invited_by_user_id.is_(None),
            OrganizationInvitation.accepted_at.is_(None), OrganizationInvitation.revoked_at.is_(None),
        ).with_for_update().one_or_none()
        if invitation is None:
            raise HTTPException(status_code=409, detail="No pending owner setup invitation. The owner may already have activated the account.")
        raw_token = secrets.token_urlsafe(32)
        invitation.token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        invitation.expires_at = datetime.now(timezone.utc) + timedelta(hours=organizations.INVITATION_EXPIRE_HOURS)
        audit(db, admin, workspace, "RESEND_OWNER_SETUP")
        db.commit()
        return {"email_sent": send_owner_setup(workspace, invitation, raw_token)}


def reject_cross_workspace_dependencies(db, organization_id):
    """Refuse cascades that could touch another tenant's legacy/corrupt records."""
    for table in Base.metadata.tables.values():
        if "organization_id" not in table.c or table.name == "organizations":
            continue
        for foreign_key in table.foreign_keys:
            parent = foreign_key.column.table
            if parent.name == "organizations" or "organization_id" not in parent.c:
                continue
            child_alias, parent_alias = table.alias("dependent"), parent.alias("target")
            related = child_alias.join(parent_alias, child_alias.c[foreign_key.parent.name] == parent_alias.c[foreign_key.column.name])
            conflict = db.execute(select(1).select_from(related).where(
                parent_alias.c.organization_id == organization_id,
                child_alias.c.organization_id != organization_id,
            ).limit(1)).first()
            if conflict:
                raise HTTPException(status_code=409, detail="Cross-workspace linked records require repair before deletion. Nothing was deleted.")


def delete_workspace(db, admin, organization_id, confirmation_slug):
    with platform_scope(db):
        workspace = lock_workspace(db, organization_id)
        if workspace.status != "SUSPENDED":
            raise HTTPException(status_code=409, detail="Suspend the workspace before permanently deleting it.")
        if confirmation_slug != workspace.slug:
            raise HTTPException(status_code=422, detail="Type the exact workspace address to confirm deletion.")
        subscription = db.query(OrganizationSubscription).filter(OrganizationSubscription.organization_id == workspace.organization_id).one_or_none()
        if subscription and subscription.provider_subscription_id and subscription.status not in {"CANCELLED", "CANCELED"}:
            raise HTTPException(status_code=409, detail="Cancel the external billing subscription before deleting this workspace.")
        reject_cross_workspace_dependencies(db, organization_id)
        audit(db, admin, workspace, "DELETE")
        try:
            # Remove RESTRICT dependents before the root cascade. Every statement is tenant-scoped.
            db.execute(delete(OrganizationInvitation).where(OrganizationInvitation.organization_id == organization_id))
            db.execute(delete(Workflow).where(Workflow.organization_id == organization_id))
            db.execute(delete(Team).where(Team.organization_id == organization_id))
            db.execute(delete(Organization).where(Organization.organization_id == organization_id))
            db.commit()
        except IntegrityError:
            raise HTTPException(status_code=409, detail="Linked records prevented deletion. Nothing was deleted; contact support.")
