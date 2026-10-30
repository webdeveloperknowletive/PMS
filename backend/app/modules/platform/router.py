from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, text
from sqlalchemy.orm import Session, joinedload

from db.session import get_db
from app.core.dependencies import get_current_platform_admin
from app.modules.audit.model import AuditEvent
from app.modules.auth.model import LoginHistory
from app.modules.organizations.model import Organization, OrganizationSubscription
from app.modules.roles.model import UserRole
from app.modules.users.model import User
from app.modules.platform.model import PlatformAdmin

router = APIRouter(prefix="/platform", tags=["Platform Administration"])


def _global_session(db: Session):
    """Temporarily disable workspace criteria for read-only platform queries."""
    organization_id = db.info.pop("organization_id", None)
    return organization_id


def _restore_session(db: Session, organization_id) -> None:
    if organization_id is not None:
        db.info["organization_id"] = organization_id


@router.get("/overview")
async def platform_overview(current_admin: PlatformAdmin = Depends(get_current_platform_admin), db: Session = Depends(get_db)):
    previous = _global_session(db)
    try:
        now = datetime.now(timezone.utc)
        week_ago = now - timedelta(days=7)
        month_ago = now - timedelta(days=30)
        total_orgs = db.query(func.count(Organization.organization_id)).scalar() or 0
        total_users = db.query(func.count(User.user_id)).scalar() or 0
        active_7 = db.query(func.count(func.distinct(LoginHistory.user_id))).filter(LoginHistory.login_time >= week_ago, LoginHistory.is_successful.is_(True)).scalar() or 0
        active_30 = db.query(func.count(func.distinct(LoginHistory.user_id))).filter(LoginHistory.login_time >= month_ago, LoginHistory.is_successful.is_(True)).scalar() or 0
        statuses = dict(db.query(Organization.status, func.count(Organization.organization_id)).group_by(Organization.status).all())
        plans = dict(db.query(OrganizationSubscription.status, func.count(OrganizationSubscription.subscription_id)).group_by(OrganizationSubscription.status).all())
        recent = db.query(Organization).order_by(Organization.created_at.desc()).limit(5).all()
        return {
            "total_organizations": total_orgs,
            "total_users": total_users,
            "active_users_7d": active_7,
            "active_users_30d": active_30,
            "workspace_statuses": statuses,
            "subscription_statuses": plans,
            "recent_organizations": [{"organization_id": item.organization_id, "name": item.name, "slug": item.slug, "created_at": item.created_at} for item in recent],
        }
    finally:
        _restore_session(db, previous)


@router.get("/organizations")
async def platform_organizations(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: str | None = Query(None, max_length=120),
    current_admin: PlatformAdmin = Depends(get_current_platform_admin),
    db: Session = Depends(get_db),
):
    previous = _global_session(db)
    try:
        query = db.query(Organization)
        if search and search.strip():
            term = f"%{search.strip()}%"
            query = query.filter((Organization.name.ilike(term)) | (Organization.slug.ilike(term)))
        organizations = query.order_by(Organization.created_at.desc()).offset(skip).limit(limit).all()
        counts = dict(db.query(User.organization_id, func.count(User.user_id)).group_by(User.organization_id).all())
        subscriptions = {row.organization_id: row for row in db.query(OrganizationSubscription).all()}
        return [{
            "organization_id": item.organization_id, "name": item.name, "slug": item.slug,
            "status": item.status, "plan_code": item.plan_code, "created_at": item.created_at,
            "user_count": counts.get(item.organization_id, 0),
            "subscription_status": subscriptions.get(item.organization_id).status if subscriptions.get(item.organization_id) else None,
            "trial_ends_at": subscriptions.get(item.organization_id).trial_ends_at if subscriptions.get(item.organization_id) else None,
        } for item in organizations]
    finally:
        _restore_session(db, previous)


@router.get("/organizations/{organization_id}")
async def platform_organization_detail(organization_id: str, current_admin: PlatformAdmin = Depends(get_current_platform_admin), db: Session = Depends(get_db)):
    previous = _global_session(db)
    try:
        organization = db.query(Organization).filter(Organization.organization_id == organization_id).one_or_none()
        if organization is None:
            raise HTTPException(status_code=404, detail="Organization not found")
        subscription = db.query(OrganizationSubscription).filter(OrganizationSubscription.organization_id == organization.organization_id).one_or_none()
        users = db.query(User).options(joinedload(User.user_roles).joinedload(UserRole.role)).filter(User.organization_id == organization.organization_id).order_by(User.created_at.desc()).limit(25).all()
        last_activity = db.query(AuditEvent.created_at).filter(AuditEvent.organization_id == organization.organization_id).order_by(AuditEvent.created_at.desc()).first()
        return {
            "organization_id": organization.organization_id, "name": organization.name, "slug": organization.slug,
            "status": organization.status, "plan_code": organization.plan_code, "created_at": organization.created_at,
            "last_activity_at": last_activity[0] if last_activity else None,
            "user_count": db.query(func.count(User.user_id)).filter(User.organization_id == organization.organization_id).scalar() or 0,
            "subscription": {"status": subscription.status, "plan_code": subscription.plan_code, "trial_ends_at": subscription.trial_ends_at} if subscription else None,
            "users": [{"user_id": user.user_id, "name": user.name, "email": user.email, "is_active": user.is_active, "role_names": user.role_names} for user in users],
        }
    finally:
        _restore_session(db, previous)


@router.post("/organizations/{organization_id}/status")
async def platform_organization_status(
    request: Request,
    organization_id: str,
    status: str = Query(..., pattern="^(ACTIVE|SUSPENDED)$"),
    current_admin: PlatformAdmin = Depends(get_current_platform_admin),
    db: Session = Depends(get_db),
):
    previous = _global_session(db)
    try:
        organization = db.query(Organization).filter(Organization.organization_id == organization_id).one_or_none()
        if organization is None:
            raise HTTPException(status_code=404, detail="Organization not found")
        organization.status = status
        db.commit()
        if request is not None:
            request.state.audit_organization_id = str(organization.organization_id)
            request.state.audit_actor = current_admin.name
            request.state.audit_roles = "Super Admin"
        return {"organization_id": organization.organization_id, "status": organization.status}
    finally:
        _restore_session(db, previous)


@router.get("/plans")
async def platform_plans(current_admin: PlatformAdmin = Depends(get_current_platform_admin), db: Session = Depends(get_db)):
    previous = _global_session(db)
    try:
        rows = db.query(OrganizationSubscription.plan_code, OrganizationSubscription.status, func.count(OrganizationSubscription.subscription_id)).group_by(OrganizationSubscription.plan_code, OrganizationSubscription.status).all()
        return [{"plan_code": plan, "subscription_status": status, "organization_count": count} for plan, status, count in rows]
    finally:
        _restore_session(db, previous)


@router.get("/users")
async def platform_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    search: str | None = Query(None, max_length=120),
    current_admin: PlatformAdmin = Depends(get_current_platform_admin),
    db: Session = Depends(get_db),
):
    previous = _global_session(db)
    try:
        query = db.query(User).options(joinedload(User.user_roles).joinedload(UserRole.role))
        if search and search.strip():
            term = f"%{search.strip()}%"
            query = query.filter((User.name.ilike(term)) | (User.email.ilike(term)))
        users = query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()
        organizations = {item.organization_id: item for item in db.query(Organization).all()}
        return [{
            "user_id": user.user_id, "name": user.name, "email": user.email,
            "organization_name": organizations.get(user.organization_id).name if organizations.get(user.organization_id) else "Unknown",
            "role_names": user.role_names, "is_active": user.is_active,
            "is_email_verified": user.is_email_verified, "created_at": user.created_at,
        } for user in users]
    finally:
        _restore_session(db, previous)


@router.get("/audit-logs")
async def platform_audit_logs(
    skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500),
    current_admin: PlatformAdmin = Depends(get_current_platform_admin), db: Session = Depends(get_db),
):
    previous = _global_session(db)
    try:
        return db.query(AuditEvent).order_by(AuditEvent.created_at.desc()).offset(skip).limit(limit).all()
    finally:
        _restore_session(db, previous)


@router.get("/health")
async def platform_health(current_admin: PlatformAdmin = Depends(get_current_platform_admin), db: Session = Depends(get_db)):
    database = "healthy"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        database = "unavailable"
    return {"api": "healthy", "database": database, "email_provider": "configured" if __import__("app.core.config", fromlist=["SMTP_HOST"]).SMTP_HOST else "not_configured"}
