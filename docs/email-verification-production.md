# Email verification repair and production runbook

## Findings and scope

The existing flow is POST /api/v1/organizations/register -> stored email token -> frontend /verify-email -> POST /api/v1/auth/verify-email -> POST /api/v1/auth/login. Resend is POST /api/v1/auth/resend-verification. The retired /auth/register returns 410. User.is_email_verified and User.is_active gate login; email_verification_tokens holds ownership, expiry and consumption status.

The source identified pms.knowletive.in as the public app host (frontend middleware explicitly reserves pms). Before this fix, production registration and resend used workspace_app_url, which constructs <slug>.<WORKSPACE_DOMAIN> and omits workspace_slug in production. That ignores PUBLIC_APP_URL for verification, depends on wildcard routing/certificates and loses explicit workspace context. A wrong WORKSPACE_DOMAIN or an unrouted workspace host produces a broken link despite a working login hostname. The frontend verification route already existed; this was not a missing-route implementation in the checkout.

This is a confirmed source defect, not a proven diagnosis of the currently running containers. Neither a real failing email URL nor Coolify configuration was available. Read-only web probes to both public /verify-email URLs failed in the web tool. Do not claim that a workspace root 307 establishes verification health. Compare a redacted failing link (hostname/path/query keys only) and deployed revision before declaring the production 404 resolved.

## Changes

- backend/app/core/config.py: verification-specific canonical URL builder, encoded token/workspace query, stricter production URL validation. Other workspace link routes remain intact.
- backend/app/modules/organizations/service.py: registration uses canonical builder, SHA-256 token storage and verification mail template.
- backend/app/modules/auth/service.py: unique random JWT jti, hashed new verification tokens, database-backed per-account 60-second resend cooldown with row locking, supersession of old links, tenant/user/expiry validation, atomic activation/consumption, idempotent already-verified response. Outstanding legacy plaintext token rows remain readable until expiry.
- backend/app/modules/auth/router.py: existing verification endpoint accepts optional workspace_slug; signature verification identifies the user even for old links with no context.
- backend/app/core/email.py: escaped multipart SprintIX verification template, 24-hour expiry, fallback address and resend page.
- frontend verification/pending pages and types: stateful confirmation, missing/invalid/expired/reused handling, resend form, workspace-preserving login navigation, removal of token from address after success. Explicit Verify email click prevents automatic consumption by mail link scanners.
- frontend/next.config.js: no-referrer, no-store and noindex headers on verification page.
- backend/tests/test_email_verification.py: URL encoding, unique tokens, successful/reused/replaced/expired/invalid/wrong-workspace behavior.

No schema migration or destructive operation is required: hashes fit the existing token column. Existing plaintext rows are a temporary compatibility allowance, not newly issued storage. Do not export token rows or paste tokens into logs. No DNS, database volumes, application domains, Traefik labels, unrelated files or production environment values were changed.

## Coolify deployment

1. Record current frontend/backend deployed commit, domains, build/start settings, network and environment names. Securely back up PostgreSQL using the existing backup mechanism. Preserve all existing secrets and volumes.
2. In backend environment set APP_ENV=production, DEBUG=False, PUBLIC_APP_URL=https://pms.knowletive.in and WORKSPACE_DOMAIN=knowletive.in (confirm existing tenant domain before changing it). Keep SECRET_KEY, DATABASE_URL and SMTP values unchanged. SECRET_KEY must remain stable so outstanding emails remain valid. Keep SMTP TLS enabled.
3. ALLOW_ORIGINS must include https://pms.knowletive.in and https://knowletive-services.knowletive.in alongside any other explicitly authorized existing frontend origins. Do not add *. The existing workspace-origin regex also permits HTTPS tenant subdomains under WORKSPACE_DOMAIN; retain only if that entire domain is controlled for workspaces.
4. Set frontend build-time NEXT_PUBLIC_API_URL to the verified public HTTPS API base including /api/v1, and NEXT_PUBLIC_WORKSPACE_DOMAIN=knowletive.in. The actual public API hostname was not provided: copy and validate the existing Coolify backend domain, do not invent one. NEXT_PUBLIC values require a rebuild. Preserve existing build settings and frontend internal port 3000; backend stays on its existing internal port 8000.
5. Rebuild/redeploy backend and frontend from this revision. Use the existing Coolify application resources and generated proxy rules. Do not replace labels, publish PostgreSQL/Redis ports, or run the development compose file as a production replacement. Do not run reset/drop or unrelated migrations.
6. On both frontend hostnames, request /verify-email without token: require the verification page and missing-token state, not a 404 or login redirect. Check Referrer-Policy and no-store headers. Probe the real backend OPTIONS /api/v1/auth/verify-email with each frontend Origin: require exact matching allow-origin. Verify an unrelated origin is rejected.
7. With an authorized fresh test inbox register workspace A, confirm login is blocked before verification, inspect received link host/path locally, click Verify email, confirm backend 200 and database is_email_verified=true/is_active=true for only that account, then sign in with workspace A. Keep tokens out of screenshots and shell history. Confirm confirmation navigation retains workspace_slug.
8. Repeat with workspace B. Submit A token with B workspace_slug: require 400 with no change. Replay A link: require already verified with no further activation. Resend before verification, wait 60 seconds when necessary, confirm old link cannot activate and newest link works. Test malformed/missing token and controlled expired fixture in staging (do not change production clocks or signing secret).
9. Verify on both named hosts. For earlier links on workspace hosts, preserve their existing proxy routes; legacy links still validate when routed to this frontend. A newly sent link always uses PUBLIC_APP_URL.
10. Review proxy logging: omit/redact token query parameters on /verify-email, avoid logging verification request bodies, and never enable SMTP debug logging. The frontend cannot redact the original navigation from upstream logs. Trust forwarded headers only from the existing trusted proxy network. No redirect target is accepted from verification input: login uses a local fixed route.

Rollback: redeploy the previous frontend/backend revision without modifying data, but note the old backend cannot consume newly hashed token rows. Prefer rolling forward or request new emails after rollback. Retain current database and signing key.

## Security limits and acceptance evidence

Authentication uses bearer tokens in localStorage; the pms_has_session cookie is a UI marker, not an authentication credential. This change does not migrate the authentication architecture. Resend has a persistent per-account cooldown; IP/global anti-abuse controls at the existing ingress are still needed against distributed enumeration/SMTP abuse. Production resend response fields are uniform across account existence/delivery outcomes, but synchronous SMTP timing can still reveal account state; a durable mail queue would be needed to remove that timing difference fully.

Local service tests use mocked sessions and do not prove PostgreSQL row-lock behavior, SMTP delivery, deployed CORS, or production login. Fresh-account production acceptance remains pending authenticated Coolify/VPS and test-inbox access. No production deployment or database modification was performed by this change.


## Local verification results

- `PYTHONPATH=backend backend/.venv/Scripts/python.exe -m pytest backend/tests/test_email_verification.py backend/tests/test_invitation_email.py -q`: 16 passed. Session behavior is mocked; no production database touched.
- Frontend `npx tsc --noEmit --incremental false`: passed.
- Frontend `npm run build`: passed; both verification routes generated. Existing image optimization and React hook warnings remain elsewhere in the app. Initial sandbox output-directory permissions and a page encoding issue were resolved before the successful build.
- Scoped `git diff --check`: passed.
- Existing combined CORS test run stalled and was interrupted; do not count deployed or local full-app CORS checks as passed. Live route probes were inaccessible through the web tool.
- Fresh registration, real SMTP receipt, PostgreSQL concurrency, both deployed hosts and successful production workspace login remain unverified pending deployment/inbox access.


## Live browser follow-up (2026-11-03)

After the user supplied the Coolify URL and test inbox, the in-app browser reached /verify-email on both https://pms.knowletive.in and https://knowletive-services.knowletive.in. Both served the existing verification page, rather than a 404. Clicking Verify email without a token on the PMS host displayed the expected missing-token message. The visible UI still matched the previous implementation (no resend form); deployment of this fix is not yet established. This rules out a universally absent frontend route on those two hostnames, but does not establish what hostname/path the failing email actually used or whether token verification succeeds.

The supplied Coolify dashboard reached its login form. Authenticated deployment configuration, actual received email URL and inbox-to-login testing remain pending user sign-in. No production deployment, resend, account creation or database mutation was performed during these browser checks. The test inbox is user-controlled and will be used only for the requested acceptance flow.


## Received live failure evidence

The user supplied a screenshot showing the deployed verification page and an HTTP 400 response with message "This verification link has already been used or is invalid". In the previous backend implementation that exact message follows successful JWT decode and user lookup, when the tenant-scoped stored token lookup returns no row or the row is already used. This evidence does not identify which condition occurred and does not establish that the email URL hostname caused this failure. Check the user's verification flags and non-secret token metadata in the same database used by the backend. Try login if already verified; otherwise request a new email and test only the newest token. No token value should be copied into SQL, logs or reports.


## Pre-login recovery path

The login page now always offers "Resend verification email" without requiring a password or a successful login attempt. It links to the existing public pending-verification page with workspace context. That page accepts an editable email address and posts to the existing unauthenticated resend endpoint directly. It no longer incorrectly reports SMTP misconfiguration merely because its sent query parameter is absent. The return-to-login link retains workspace context. Verification still happens server-side before login is permitted. Deploy these frontend changes together with the backend verification repair; local files alone do not update the running site.
