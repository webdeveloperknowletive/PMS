from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenException
from app.core.permissions import has_permission
from app.core.permissions import require_permission
from app.modules.organizations import service
from app.modules.organizations.model import Organization, OrganizationInvitation, OrganizationSubscription
from app.modules.organizations.schema import (
    InvitationAccept,
    InvitationAcceptRead,
    InvitationPreviewRead,
    WorkspaceInviteCreate,
    WorkspaceInviteRead,
    WorkspaceOwnerCreate,
    WorkspaceRead,
    WorkspaceRegistrationRead,
    WorkspaceUpdate,
)
from app.modules.roles.model import Role, UserRole
from app.modules.users.model import User
from db.session import get_db

router = APIRouter(prefix="/organizations", tags=["Organizations"])


def require_invitation_manager(user: User, db: Session) -> None:
    if not has_permission(db, user, "invitations.manage"):
        raise ForbiddenException(message="You need permission to invite and manage organization members.")


@router.post("/register", response_model=WorkspaceRegistrationRead, status_code=status.HTTP_201_CREATED)
async def register_workspace(payload: WorkspaceOwnerCreate, request: Request, db: Session = Depends(get_db)):
    user, organization, email_sent, verification_url = service.register_workspace_owner(db, payload)
    request.state.audit_actor = user.name
    request.state.audit_roles = ["Super Admin"]
    request.state.audit_organization_id = str(organization.organization_id)
    return {
        "user_id": user.user_id,
        "organization": organization,
        "verification_required": True,
        "verification_email_sent": email_sent,
        "verification_url": verification_url,
    }


@router.get("/current", response_model=WorkspaceRead)
async def get_current_organization(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    organization = db.get(Organization, current_user.organization_id)
    if organization is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    subscription = db.query(OrganizationSubscription).filter(
        OrganizationSubscription.organization_id == current_user.organization_id
    ).one_or_none()
    return {
        "organization_id": organization.organization_id,
        "name": organization.name,
        "slug": organization.slug,
        "status": organization.status,
        "plan_code": organization.plan_code,
        "created_at": organization.created_at,
        "subscription_status": subscription.status if subscription else None,
        "trial_ends_at": subscription.trial_ends_at if subscription else None,
    }


@router.patch("/current", response_model=WorkspaceRead)
async def update_current_organization(
    payload: WorkspaceUpdate,
    current_user: User = Depends(require_permission("organization.manage")),
    db: Session = Depends(get_db),
):
    organization = service.update_workspace(db, current_user.organization_id, payload)
    subscription = db.query(OrganizationSubscription).filter(
        OrganizationSubscription.organization_id == current_user.organization_id
    ).one_or_none()
    return {
        "organization_id": organization.organization_id,
        "name": organization.name,
        "slug": organization.slug,
        "status": organization.status,
        "plan_code": organization.plan_code,
        "created_at": organization.created_at,
        "subscription_status": subscription.status if subscription else None,
        "trial_ends_at": subscription.trial_ends_at if subscription else None,
    }


@router.get("/invitations", response_model=list[WorkspaceInviteRead])
async def list_invitations(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_invitation_manager(current_user, db)
    invitations = db.query(OrganizationInvitation).filter(
        OrganizationInvitation.organization_id == current_user.organization_id,
    ).order_by(OrganizationInvitation.created_at.desc()).all()
    return invitations


@router.post("/invitations", response_model=WorkspaceInviteRead, status_code=status.HTTP_201_CREATED)
async def invite_member(
    payload: WorkspaceInviteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_invitation_manager(current_user, db)
    invitation, _, email_sent = service.create_invitation(
        db,
        current_user.organization_id,
        current_user,
        str(payload.email),
        payload.role_id,
    )
    return {
        "invitation_id": invitation.invitation_id,
        "email": invitation.email,
        "role_id": invitation.role_id,
        "created_at": invitation.created_at,
        "expires_at": invitation.expires_at,
        "email_sent": email_sent,
    }


@router.delete("/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_invitation(
    invitation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_invitation_manager(current_user, db)
    invitation = db.query(OrganizationInvitation).filter(
        OrganizationInvitation.invitation_id == invitation_id,
        OrganizationInvitation.organization_id == current_user.organization_id,
    ).one_or_none()
    if invitation is None:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if invitation.accepted_at is not None:
        raise HTTPException(status_code=409, detail="An accepted invitation cannot be revoked")
    invitation.revoked_at = datetime.now(timezone.utc)
    db.commit()


@router.post("/invitations/{invitation_id}/resend", response_model=WorkspaceInviteRead)
async def resend_workspace_invitation(
    invitation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_invitation_manager(current_user, db)
    invitation = db.query(OrganizationInvitation).filter(
        OrganizationInvitation.invitation_id == invitation_id,
        OrganizationInvitation.organization_id == current_user.organization_id,
    ).one_or_none()
    if invitation is None:
        raise HTTPException(status_code=404, detail="Invitation not found")
    invitation, _, email_sent = service.resend_invitation(db, invitation)
    return {
        "invitation_id": invitation.invitation_id,
        "email": invitation.email,
        "role_id": invitation.role_id,
        "created_at": invitation.created_at,
        "expires_at": invitation.expires_at,
        "accepted_at": invitation.accepted_at,
        "revoked_at": invitation.revoked_at,
        "email_sent": email_sent,
    }


@router.post("/invitations/accept", response_model=InvitationAcceptRead, status_code=status.HTTP_201_CREATED)
async def accept_workspace_invitation(payload: InvitationAccept, request: Request, db: Session = Depends(get_db)):
    user, organization = service.accept_invitation(db, payload)
    role_names = db.query(Role.role_name).join(UserRole, UserRole.role_id == Role.role_id).filter(
        UserRole.user_id == user.user_id
    ).all()
    request.state.audit_actor = user.name
    request.state.audit_roles = sorted(role_name for (role_name,) in role_names)
    request.state.audit_organization_id = str(organization.organization_id)
    return {"user_id": user.user_id, "organization": organization}


@router.get("/invitations/preview", response_model=InvitationPreviewRead)
async def preview_workspace_invitation(
    token: str = Query(min_length=20, max_length=256),
    db: Session = Depends(get_db),
):
    return service.preview_invitation(db, token)
