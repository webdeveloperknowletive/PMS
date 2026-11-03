"""Isolated database tests: never connect to the configured application database."""
import hashlib
from urllib.parse import urlsplit, parse_qs
from uuid import uuid4

import pytest
from fastapi import HTTPException, Request
from sqlalchemy import create_engine, event, select, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

import app.router  # register all ORM relationship targets
from app.core.database import Base
from app.core.dependencies import get_current_user
from app.core.workspaces import require_active_workspace
from app.modules.auth import service as auth
from app.modules.organizations import service as onboarding
from app.modules.organizations.model import Organization, OrganizationInvitation
from app.modules.organizations.schema import InvitationAccept, WorkspaceUpdate
from app.modules.platform import service, router
from app.modules.platform.model import PlatformAdmin, PlatformAuditEvent
from app.modules.platform.schema import PlatformWorkspaceCreate
from app.modules.users.model import User
from app.modules.roles.model import Role, UserRole
from app.modules.projects.model import Project
from app.modules.teams.model import Team, TeamLead
from app.modules.workflow.model import Workflow
from db.session import get_db


@compiles(JSONB, "sqlite")
def sqlite_jsonb(type_, compiler, **kw):
    return "JSON"


@pytest.fixture
def db(monkeypatch):
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    @event.listens_for(engine, "connect")
    def foreign_keys(connection, record):
        connection.execute("PRAGMA foreign_keys=ON")
    @event.listens_for(engine, "before_cursor_execute", retval=True)
    def ddl_casts(connection, cursor, statement, parameters, context, many):
        return (statement.replace("::jsonb", "") if statement.lstrip().startswith("CREATE TABLE") else statement), parameters
    Base.metadata.create_all(engine)
    monkeypatch.setattr(service, "send_workspace_invitation", lambda *args, **kwargs: True)
    with Session(engine) as session:
        yield session
    engine.dispose()


@pytest.fixture
def admin(db):
    admin = PlatformAdmin(name="Platform operator", email="platform@example.com", password_hash=auth.hash_password("test-only-password"))
    db.add(admin); db.commit()
    return admin


def provision(db, admin, slug="acme", email="owner@example.com"):
    return service.create_workspace(db, admin, PlatformWorkspaceCreate(name="Example client", slug=slug, owner_email=email))


def activate_owner(db, admin, monkeypatch, slug="acme", email="owner@example.com"):
    captured = []
    monkeypatch.setattr(service, "send_workspace_invitation", lambda *args, **kwargs: captured.append(args[2]) or True)
    result = provision(db, admin, slug, email)
    token = parse_qs(urlsplit(captured[-1]).query)["token"][0]
    user, workspace = onboarding.accept_invitation(db, InvitationAccept(token=token, name="Client owner", password="test-only-password", accepted_terms=True))
    db.info.clear()
    return user, workspace


def test_provision_owner_setup_without_password_or_false_terms_acceptance(db, admin, monkeypatch):
    captured = []
    monkeypatch.setattr(service, "send_workspace_invitation", lambda *args, **kwargs: captured.append(args[2]) or True)
    result = provision(db, admin)
    assert result["email_sent"]
    assert db.scalar(select(func.count()).select_from(User)) == 0
    invitation = db.scalars(select(OrganizationInvitation)).one()
    token = parse_qs(urlsplit(captured[0]).query)["token"][0]
    assert invitation.invited_by_user_id is None
    assert invitation.token_hash == hashlib.sha256(token.encode()).hexdigest()
    assert "token" not in result and "invitation_url" not in result
    user, workspace = onboarding.accept_invitation(db, InvitationAccept(token=token, name="Owner", password="test-only-password", accepted_terms=True))
    assert user.is_email_verified and user.terms_accepted_at
    assert user.role_names == ["Workspace Owner"]


def test_update_uniqueness_reserved_slug_and_scope_restored(db, admin):
    first = provision(db, admin)
    second = provision(db, admin, "other-client", "second@example.com")
    old_scope = uuid4()
    db.info["organization_id"] = old_scope
    for slug in ["other-client", "pms"]:
        with pytest.raises(HTTPException):
            service.update_workspace(db, admin, first["organization_id"], WorkspaceUpdate(name="Changed", slug=slug))
        assert db.info["organization_id"] == old_scope
    service.update_workspace(db, admin, first["organization_id"], WorkspaceUpdate(name="Updated client", slug="new-address"))
    assert db.info["organization_id"] == old_scope
    db.info.clear()
    assert db.get(Organization, second["organization_id"]).slug == "other-client"


def test_suspend_blocks_login_refresh_and_existing_access_then_reactivate(db, admin, monkeypatch):
    user, workspace = activate_owner(db, admin, monkeypatch)
    credentials = auth.login(db, user.email, "test-only-password")
    db.info.clear()
    service.set_status(db, admin, workspace.organization_id, "SUSPENDED")
    for operation in [
        lambda: auth.login(db, user.email, "test-only-password"),
        lambda: auth.refresh_token(db, credentials["refresh_token"]),
        lambda: get_current_user(Request({"type": "http"}), credentials["access_token"], db),
    ]:
        with pytest.raises(HTTPException) as exc:
            operation()
        assert exc.value.status_code == 403
        db.info.clear()
    assert db.get(User, user.user_id).is_active
    service.set_status(db, admin, workspace.organization_id, "ACTIVE")
    assert auth.login(db, user.email, "test-only-password")["access_token"]


def test_resend_supersedes_link_and_suspension_blocks_owner_setup(db, admin, monkeypatch):
    captured = []
    monkeypatch.setattr(service, "send_workspace_invitation", lambda *args, **kwargs: captured.append(args[2]) or True)
    result = provision(db, admin)
    previous = parse_qs(urlsplit(captured[-1]).query)["token"][0]
    service.resend_owner_setup(db, admin, result["organization_id"])
    newest = parse_qs(urlsplit(captured[-1]).query)["token"][0]
    assert newest != previous
    with pytest.raises(HTTPException):
        onboarding.preview_invitation(db, previous)
    service.set_status(db, admin, result["organization_id"], "SUSPENDED")
    with pytest.raises(HTTPException):
        onboarding.accept_invitation(db, InvitationAccept(token=newest, name="Owner", password="test-only-password", accepted_terms=True))
    assert db.scalar(select(func.count()).select_from(User)) == 0


def test_delete_requires_suspend_and_matching_confirmation(db, admin):
    result = provision(db, admin)
    id = result["organization_id"]
    with pytest.raises(HTTPException):
        service.delete_workspace(db, admin, id, "acme")
    service.set_status(db, admin, id, "SUSPENDED")
    with pytest.raises(HTTPException):
        service.delete_workspace(db, admin, id, "wrong-workspace")
    assert db.get(Organization, id) is not None


def test_delete_cascades_only_selected_tenant_and_preserves_platform_audit(db, admin, monkeypatch):
    user, target = activate_owner(db, admin, monkeypatch)
    other = provision(db, admin, "second-client", "second@example.com")
    db.info["organization_id"] = target.organization_id
    project = Project(project_name="Client project", project_key="CLIENT")
    lead = TeamLead(user_id=user.user_id)
    db.add_all([project, lead]); db.flush()
    db.add_all([Team(project_id=project.project_id, team_lead_id=lead.team_lead_id, team_name="Delivery"), Workflow(project_id=project.project_id, team_lead_id=lead.team_lead_id, workflow_name="Delivery")]); db.commit()
    db.info.clear()
    target_id = target.organization_id
    service.set_status(db, admin, target_id, "SUSPENDED")
    service.delete_workspace(db, admin, target_id, "acme")
    db.expire_all()
    assert db.get(Organization, target_id) is None
    assert db.scalar(select(func.count()).select_from(User).where(User.organization_id == target_id)) == 0
    assert db.get(Organization, other["organization_id"]) is not None
    assert db.get(PlatformAdmin, admin.platform_admin_id) is not None
    assert db.scalars(select(PlatformAuditEvent).where(PlatformAuditEvent.organization_id == target_id, PlatformAuditEvent.action == "DELETE")).one()


def test_platform_endpoints_require_platform_authentication(db, admin):
    from app.core.dependencies import get_current_platform_admin
    from fastapi.dependencies.utils import get_dependant
    # Verify the production route dependency graph, and exercise the actual
    # authentication dependency without TestClient's Windows background thread.
    for route in router.router.routes:
        if route.methods & {"POST", "PATCH", "DELETE"}:
            graph = get_dependant(path=route.path, call=route.endpoint)
            assert get_current_platform_admin in [item.call for item in graph.dependencies]
    customer_token = auth.create_token(str(uuid4()), 10, "access")[0]
    with pytest.raises(HTTPException) as exc:
        get_current_platform_admin(Request({"type": "http"}), customer_token, db)
    assert exc.value.status_code == 401
    platform_token = auth.create_token(str(admin.platform_admin_id), 10, "platform_access")[0]
    assert get_current_platform_admin(Request({"type": "http"}), platform_token, db).platform_admin_id == admin.platform_admin_id


def test_self_signup_still_issues_verification_after_shared_bootstrap(db, monkeypatch):
    from app.modules.organizations.schema import WorkspaceOwnerCreate
    monkeypatch.setattr(onboarding, "send_verification_email", lambda *args: True)
    monkeypatch.setattr(onboarding, "APP_ENV", "testing")
    user, workspace, sent, url = onboarding.register_workspace_owner(db, WorkspaceOwnerCreate(
        name="Self signup", email="signup@example.com", password="test-only-password",
        organization_name="Signup client", workspace_slug="self-signup", accepted_terms=True))
    assert sent and not user.is_email_verified
    assert user.role_names == ["Workspace Owner"]
    assert workspace.slug == "self-signup"


def test_external_billing_blocks_delete_without_touching_data(db, admin):
    from app.modules.organizations.model import OrganizationSubscription
    result = provision(db, admin)
    id = result["organization_id"]
    subscription = db.scalars(select(OrganizationSubscription).where(OrganizationSubscription.organization_id == id)).one()
    subscription.provider_subscription_id = "subscription-test"
    subscription.status = "ACTIVE"
    db.commit()
    service.set_status(db, admin, id, "SUSPENDED")
    with pytest.raises(HTTPException) as exc:
        service.delete_workspace(db, admin, id, "acme")
    assert exc.value.status_code == 409
    assert db.get(Organization, id) is not None
    assert db.scalars(select(OrganizationInvitation).where(OrganizationInvitation.organization_id == id)).one()


def test_delete_failure_rolls_back_prior_deletes_and_audit(db, admin, monkeypatch):
    from sqlalchemy.exc import IntegrityError
    from sqlalchemy.sql.dml import Delete
    result = provision(db, admin)
    id = result["organization_id"]
    service.set_status(db, admin, id, "SUSPENDED")
    execute = db.execute
    def fail_at_root(statement, *args, **kwargs):
        if isinstance(statement, Delete) and statement.table.name == "organizations":
            raise IntegrityError("delete", {}, Exception("test constraint failure"))
        return execute(statement, *args, **kwargs)
    monkeypatch.setattr(db, "execute", fail_at_root)
    with pytest.raises(HTTPException) as exc:
        service.delete_workspace(db, admin, id, "acme")
    assert exc.value.status_code == 409
    assert db.get(Organization, id) is not None
    assert db.scalars(select(OrganizationInvitation).where(OrganizationInvitation.organization_id == id)).one()
    assert db.scalars(select(PlatformAuditEvent).where(PlatformAuditEvent.organization_id == id, PlatformAuditEvent.action == "DELETE")).first() is None


def test_pending_owner_display_and_duplicate_setup_rejection(db, admin):
    result = provision(db, admin)
    detail = router.platform_organization_detail(result["organization_id"], current_admin=admin, db=db)
    assert detail["owner_setup_pending"]
    assert detail["owner"]["email"] == "owner@example.com"
    with pytest.raises(HTTPException) as exc:
        provision(db, admin, "different-client", "owner@example.com")
    assert exc.value.status_code == 409
    assert db.scalar(select(func.count()).select_from(Organization)) == 1


def test_platform_identity_cannot_be_provisioned_as_customer_owner(db, admin):
    with pytest.raises(HTTPException) as exc:
        provision(db, admin, "admin-client", admin.email)
    assert exc.value.status_code == 409
    assert db.scalar(select(func.count()).select_from(Organization)) == 0


def test_legacy_cross_tenant_reference_blocks_cascade(db, admin):
    from sqlalchemy import update
    from app.modules.roles.model import RolePermission
    target = provision(db, admin)
    other = provision(db, admin, "other-tenant", "other@example.com")
    role = db.scalars(select(Role).where(Role.organization_id == target["organization_id"])).first()
    grant = db.scalars(select(RolePermission).where(RolePermission.organization_id == other["organization_id"])).first()
    # Emulate a legacy database row created before tenant foreign-key validation.
    db.execute(update(RolePermission).where(RolePermission.role_permission_id == grant.role_permission_id).values(role_id=role.role_id))
    db.commit()
    service.set_status(db, admin, target["organization_id"], "SUSPENDED")
    with pytest.raises(HTTPException) as exc:
        service.delete_workspace(db, admin, target["organization_id"], "acme")
    assert exc.value.status_code == 409
    assert db.get(Organization, target["organization_id"]) is not None
    assert db.get(Organization, other["organization_id"]) is not None
    assert db.get(RolePermission, grant.role_permission_id) is not None
