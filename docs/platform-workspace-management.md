# Super Admin client workspace management

Platform overview now offers Create workspace. Open a workspace to edit its name/address, suspend/reactivate access, resend a pending owner's setup email, or permanently delete the workspace.

## Behavior

- Provisioning accepts the client name, workspace slug and owner email. Shared onboarding code creates the subscription trial, tenant-local permission catalog and roles. A private owner invitation is mailed using the existing canonical invitation URL. The owner chooses their password and accepts the terms; only acceptance creates their verified Workspace Owner account. The platform operator never receives the token or chooses a customer password. Existing customer signup remains unchanged.
- Pending owner email and setup state appear on list/detail screens. Failed SMTP delivery leaves the new workspace intact with a Resend owner setup action. Resending supersedes the old link. Existing accounts and duplicate pending owner setups cannot silently be moved between clients.
- Editing validates names, reserved and duplicate slugs. Changing a slug changes the workspace login hostname. Keep DNS/proxy routing available for the new slug; this feature does not create DNS records. Plan and external billing administration are unchanged.
- Suspending blocks new workspace login, token refresh, authenticated workspace APIs and invitation setup, including requests using existing access tokens. Requests already in flight may finish. Reactivation restores workspace access without changing individually disabled users. It does not cancel external billing.
- Delete requires the workspace to be SUSPENDED and an exact confirmation_slug matching its current slug. External subscriptions must be cancelled first. Restricted invitation/team/workflow dependents are removed within one transaction, then the workspace's existing foreign-key cascades remove its tenant database records. Failure rolls back all steps. A preflight check refuses deletion if legacy/corrupt foreign keys would cascade into another tenant. Other workspaces and PlatformAdmin accounts remain.
- Platform audit records capture operator ID, target workspace ID/slug, action and timestamp, and survive deletion of the target. Existing customer audit history is deleted with the workspace. Platform audit records are retained in platform_audit_events; the existing customer audit-log view is unchanged.
- Physical uploaded files and backups are not purged by this database deletion; authenticated file APIs lose access once their records/users are removed. Existing retention and storage-cleanup procedures still apply. Do not represent this as a complete storage-erasure workflow.

## Endpoints

All actions require a valid platform_access token from a real active PlatformAdmin account, not a customer role named Super Admin.

- POST /api/v1/platform/organizations: {name, slug, owner_email}; returns {organization_id, email_sent}.
- Existing GET list/detail routes show client and pending-owner data.
- PATCH /api/v1/platform/organizations/{id}: {name, slug}.
- Existing POST /api/v1/platform/organizations/{id}/status?status=ACTIVE|SUSPENDED now enforces workspace access.
- POST /api/v1/platform/organizations/{id}/owner-setup/resend.
- DELETE /api/v1/platform/organizations/{id}: JSON body {confirmation_slug}; returns 204.

## Migration and deployment

Migration 20261103_34 follows 20261031_33. It makes organization_invitations.invited_by_user_id nullable for platform-issued owner invitations and adds platform_audit_events. It does not delete existing records or create platform credentials.

1. Back up the deployed PostgreSQL database and record the current revision.
2. Commit/push this feature to the revision used by Coolify. Rebuild backend and frontend.
3. Using the new backend image and its existing database environment, run `python -m alembic upgrade head` from the backend working directory before exposing the new management controls. Then roll out backend and frontend. Keep current secrets, database volumes, domains and generated Traefik labels.
4. Confirm `python -m alembic current` reports 20261103_34 (or a subsequent approved revision). Production PUBLIC_APP_URL/SMTP configuration must already be correct.
5. On an authorized disposable test client, exercise create -> owner email -> owner acceptance/sign-in -> edit -> suspend -> blocked existing session/new login -> reactivate -> suspend -> typed-confirmation delete. Verify a second client and the platform operator remain accessible. Do not delete a real customer to test.

No production migrations, customer creation, suspension or deletion have been executed by this implementation. Changes are not automatically pushed or deployed.

## Validation

- Frontend TypeScript and production build passed, with existing hook/image warnings elsewhere.
- Isolated SQLite integration tests (foreign keys enabled) cover provisioning, owner acceptance, duplicate/reserved slugs, permission dependencies, suspension/new login/refresh/existing token access, resend invalidation, ordinary self-signup, selected-tenant deletion with team/workflow dependents, external billing guard, and rollback after a simulated deletion failure.
- Final platform suite: 13 tests passed, including the cross-tenant-cascade safeguard. The earlier combined regression run passed 29 tests, including verification/email and baseline migration coverage, before that final safeguard test was added. Two opt-in PostgreSQL migration integration cases remain skipped; PostgreSQL migration SQL generation and a single Alembic head were verified. SQLite does not prove PostgreSQL concurrency/trigger behavior or SMTP delivery.
- A Windows TestClient background-thread run stalled and was interrupted; authorization was verified through the actual authentication dependency and route dependency graphs instead. Browser end-to-end and production checks remain pending.
