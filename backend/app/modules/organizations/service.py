import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.config import APP_ENV, SMTP_FROM_EMAIL, SMTP_HOST, TERMS_VERSION, TRIAL_DURATION_DAYS, workspace_app_url
from app.core.email import send_product_email, send_workspace_invitation
from app.core.permissions import PERMISSION_CATALOG
from app.modules.auth.service import VERIFY_TOKEN_EXPIRE_MINUTES, create_token, hash_password
from app.modules.auth.model import EmailVerificationToken
from app.modules.notifications.model import NotificationSetting
from app.modules.organizations.model import Organization, OrganizationInvitation, OrganizationSubscription
from app.modules.organizations.schema import InvitationAccept, WorkspaceOwnerCreate, WorkspaceUpdate
from app.modules.roles.model import Permission, Role, RolePermission, UserRole
from app.modules.roles.bootstrap import ensure_employee_roles
from app.modules.users.model import User

logger = logging.getLogger(__name__)
INVITATION_EXPIRE_HOURS = 72
RESERVED_SLUGS = {"www", "api", "admin", "app", "mail", "support", "status", "help"}


def _pending_invitation_for_token(db: Session, raw_token: str) -> OrganizationInvitation:
    """Return a usable invitation and explain why an old link cannot be used."""
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    invitation = db.query(OrganizationInvitation).filter(
        OrganizationInvitation.token_hash == token_hash
    ).one_or_none()
    if invitation is None:
        raise HTTPException(status_code=410, detail="This invitation link is invalid or has been replaced. Ask the workspace owner to resend it.")
    if invitation.accepted_at is not None:
        raise HTTPException(status_code=409, detail="This invitation was already accepted. Sign in to the workspace instead.")
    if invitation.revoked_at is not None:
        raise HTTPException(status_code=410, detail="This invitation was revoked. Ask the workspace owner to send a new invitation.")

    now = datetime.now(timezone.utc)
    expires_at = invitation.expires_at
    # Some existing SQLite development databases return naive datetimes even
    # for timezone-aware columns. Treat those stored values as UTC consistently.
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= now:
        raise HTTPException(status_code=410, detail="This invitation expired. Ask the workspace owner to resend it.")
    return invitation


def register_workspace_owner(db: Session, payload: WorkspaceOwnerCreate) -> tuple[User, Organization, bool, str | None]:
    if APP_ENV == "production" and (not SMTP_HOST or not SMTP_FROM_EMAIL):
        raise HTTPException(status_code=503, detail="Email delivery is not configured. Workspace signup is temporarily unavailable.")
    email = str(payload.email).lower()
    if db.query(User.user_id).filter(func.lower(User.email) == email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    if db.query(Organization.organization_id).filter(Organization.slug == payload.workspace_slug).first():
        raise HTTPException(status_code=409, detail="That workspace address is already taken")
    if payload.workspace_slug in RESERVED_SLUGS:
        raise HTTPException(status_code=422, detail="Choose a different workspace address")

    organization = Organization(name=payload.organization_name.strip(), slug=payload.workspace_slug)
    db.add(organization)
    db.flush()
    db.add(OrganizationSubscription(
        organization_id=organization.organization_id,
        billing_provider="none",
        plan_code="TRIAL",
        status="TRIALING",
        trial_ends_at=datetime.now(timezone.utc) + timedelta(days=TRIAL_DURATION_DAYS),
    ))
    for key, value in {
        "meeting_reminder_lead_minutes": "60",
        "toast_duration_seconds": "8",
        "notification_sound_key": "gentle_chime",
        "chat_sound_key": "double_ping",
        "chat_master_volume_percent": "100",
    }.items():
        db.add(NotificationSetting(setting_key=key, setting_value=value))

    # Each workspace owns its own action catalog and role grants.
    db.info["organization_id"] = organization.organization_id
    permission_map: dict[str, Permission] = {}
    for code, name, description, category in PERMISSION_CATALOG:
        permission = Permission(
            code=code,
            name=name,
            description=description,
            category=category,
        )
        db.add(permission)
        permission_map[code] = permission
    db.flush()

    super_admin_role = Role(
        organization_id=organization.organization_id,
        role_name="Super Admin",
        description="Platform administrator",
        is_system=True,
    )
    owner_role = Role(
        organization_id=organization.organization_id,
        role_name="Workspace Owner",
        description="Workspace owner",
        is_system=True,
    )
    db.add_all([super_admin_role, owner_role])
    db.flush()
    for role in (super_admin_role, owner_role):
        for permission in permission_map.values():
            db.add(RolePermission(
                organization_id=organization.organization_id,
                role_id=role.role_id,
                permission_id=permission.permission_id,
            ))
    db.flush()
    ensure_employee_roles(db, organization.organization_id)

    user = User(
        name=payload.name.strip(),
        email=email,
        is_active=True,
        is_email_verified=False,
        terms_accepted_at=datetime.now(timezone.utc),
        terms_version=TERMS_VERSION,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.flush()
    db.add(UserRole(user_id=user.user_id, role_id=owner_role.role_id))

    verify_token, verify_expiry = create_token(
        str(user.user_id), VERIFY_TOKEN_EXPIRE_MINUTES, "email_verification"
    )
    verification = EmailVerificationToken(
        user_id=user.user_id,
        token=verify_token,
        expires_at=verify_expiry,
    )
    db.add(verification)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="That email or workspace address was just registered. Try signing in or choose another address.") from exc
    db.refresh(user)
    db.refresh(organization)

    verification_url = workspace_app_url(
        organization.slug,
        "/verify-email",
        {"token": verify_token},
    )
    try:
        email_sent = send_product_email(
            email,
            "Verify your SprintIX workspace account",
            f"Hello {user.name},\n\nVerify your email and activate the {organization.name} workspace:\n{verification_url}\n\nThis link expires in 24 hours.",
        )
    except HTTPException:
        # Keep the created account intact; the owner can request a new link.
        logger.exception("Workspace account created but verification email could not be delivered")
        email_sent = False
    return user, organization, email_sent, verification_url if not email_sent and APP_ENV != "production" else None


def create_invitation(
    db: Session,
    organization_id,
    invited_by: User,
    email: str,
    role_id,
) -> tuple[OrganizationInvitation, str, bool]:
    email = email.strip().lower()
    role = db.query(Role).filter(Role.role_id == role_id).one_or_none()
    if role is None:
        raise HTTPException(status_code=404, detail="Role not found in this workspace")
    if role.is_system:
        raise HTTPException(status_code=400, detail="Workspace owner access cannot be granted through an invitation")
    active_organization_id = db.info.pop("organization_id", None)
    try:
        existing_user = db.query(User.user_id).filter(func.lower(User.email) == email).first()
    finally:
        if active_organization_id is not None:
            db.info["organization_id"] = active_organization_id
    if existing_user:
        raise HTTPException(status_code=409, detail="This email already has an account")
    existing = db.query(OrganizationInvitation).filter(
        OrganizationInvitation.organization_id == organization_id,
        OrganizationInvitation.email == email,
        OrganizationInvitation.accepted_at.is_(None),
        OrganizationInvitation.revoked_at.is_(None),
        OrganizationInvitation.expires_at > datetime.now(timezone.utc),
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="An active invitation already exists for this email")

    raw_token = secrets.token_urlsafe(32)
    invitation = OrganizationInvitation(
        organization_id=organization_id,
        email=email,
        role_id=role.role_id,
        invited_by_user_id=invited_by.user_id,
        token_hash=hashlib.sha256(raw_token.encode("utf-8")).hexdigest(),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=INVITATION_EXPIRE_HOURS),
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)
    # The private acceptance link is emailed to the employee, not shown to the admin.
    organization = db.query(Organization).filter_by(organization_id=organization_id).one()
    invite_url = workspace_app_url(
        organization.slug,
        "/accept-invitation",
        {"token": raw_token},
    )
    try:
        email_sent = send_workspace_invitation(
            email, organization.name, invite_url, INVITATION_EXPIRE_HOURS, inviter_name=invited_by.name,
        )
    except HTTPException:
        logger.exception("Invitation created, but email delivery failed for %s", email)
        email_sent = False
    return invitation, invite_url, email_sent


def resend_invitation(db: Session, invitation: OrganizationInvitation) -> tuple[OrganizationInvitation, str, bool]:
    """Send a fresh single-use link and invalidate any previously shared link."""
    if invitation.accepted_at is not None:
        raise HTTPException(status_code=409, detail="This invitation has already been accepted")
    if invitation.revoked_at is not None:
        raise HTTPException(status_code=409, detail="This invitation has been revoked")

    raw_token = secrets.token_urlsafe(32)
    invitation.token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    invitation.expires_at = datetime.now(timezone.utc) + timedelta(hours=INVITATION_EXPIRE_HOURS)
    db.commit()
    db.refresh(invitation)

    organization = db.query(Organization).filter_by(organization_id=invitation.organization_id).one()
    invite_url = workspace_app_url(
        organization.slug,
        "/accept-invitation",
        {"token": raw_token},
    )
    try:
        email_sent = send_workspace_invitation(
            invitation.email, organization.name, invite_url, INVITATION_EXPIRE_HOURS,
        )
    except HTTPException:
        logger.exception("Invitation link renewed, but email delivery failed for %s", invitation.email)
        email_sent = False
    return invitation, invite_url, email_sent


def accept_invitation(db: Session, payload: InvitationAccept) -> tuple[User, Organization]:
    invitation = _pending_invitation_for_token(db, payload.token)
    now = datetime.now(timezone.utc)

    # Accounts currently belong to one customer workspace. Do not silently
    # move or merge an account that already belongs to a different company.
    existing = db.query(User.user_id).filter(User.email == invitation.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="This email already has a SprintIX account. Sign in to accept a workspace invitation.")

    db.info["organization_id"] = invitation.organization_id
    role = db.query(Role).filter(
        Role.role_id == invitation.role_id,
        Role.organization_id == invitation.organization_id,
    ).one_or_none()
    if role is None:
        raise HTTPException(status_code=410, detail="The invited role is no longer available")
    user = User(
        name=payload.name.strip(),
        email=invitation.email,
        password_hash=hash_password(payload.password),
        is_active=True,
        is_email_verified=True,
        terms_accepted_at=now,
        terms_version=TERMS_VERSION,
    )
    db.add(user)
    db.flush()
    db.add(UserRole(user_id=user.user_id, role_id=role.role_id))
    invitation.accepted_at = now
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="This email already has an account or the invitation was already used") from exc
    db.refresh(user)
    organization = db.query(Organization).filter_by(organization_id=invitation.organization_id).one()
    return user, organization


def preview_invitation(db: Session, raw_token: str) -> dict:
    """Show a prospective member the workspace and role attached to a link."""
    invitation = _pending_invitation_for_token(db, raw_token)
    organization = db.query(Organization).filter_by(organization_id=invitation.organization_id).one_or_none()
    role = db.query(Role).filter(
        Role.role_id == invitation.role_id,
        Role.organization_id == invitation.organization_id,
    ).one_or_none()
    if organization is None or role is None:
        raise HTTPException(status_code=410, detail="The workspace or role for this invitation is no longer available")
    return {
        "organization_name": organization.name,
        "organization_slug": organization.slug,
        "email": invitation.email,
        "role_name": role.role_name,
        "expires_at": invitation.expires_at,
    }


def update_workspace(db: Session, organization_id, payload: WorkspaceUpdate) -> Organization:
    organization = db.query(Organization).filter(
        Organization.organization_id == organization_id
    ).one_or_none()
    if organization is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    if payload.slug in RESERVED_SLUGS:
        raise HTTPException(status_code=422, detail="Choose a different workspace address")
    another_workspace = db.query(Organization.organization_id).filter(
        Organization.slug == payload.slug,
        Organization.organization_id != organization_id,
    ).first()
    if another_workspace:
        raise HTTPException(status_code=409, detail="That workspace address is already taken")

    organization.name = payload.name
    organization.slug = payload.slug
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="That workspace address was just taken. Choose another one.") from exc
    db.refresh(organization)
    return organization
