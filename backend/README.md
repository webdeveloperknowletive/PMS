# SprintIX backend setup

## Local setup

1. Create a Python environment and install `requirements.txt`.
2. Copy `.env.example` to `.env`. Set the PostgreSQL connection, a unique `SECRET_KEY`, the frontend URL, and `WORKSPACE_DOMAIN` (keep it the same as `NEXT_PUBLIC_WORKSPACE_DOMAIN` in the frontend).
3. Before starting the API for the first time, run this from the `backend` folder:

   ```powershell
   alembic upgrade head
   ```

   The migrations create workspace tables, assign existing application data to `existing-workspace`, and add the existing chat/document/profile fields. Back up existing data before applying them.
4. Configure SMTP in `.env` to send verification and invitation emails. Without SMTP, local development shows copyable links.
5. Start the API with `uvicorn app.main:app --reload`.

For production, set `APP_ENV=production`, a random `SECRET_KEY` with at least 32 characters, a real `DATABASE_URL` (or a non-default `DB_PASSWORD`), an HTTPS `PUBLIC_APP_URL`, `WORKSPACE_DOMAIN` (hostname only), and explicit HTTPS frontend origins in `ALLOW_ORIGINS`. Add wildcard DNS and HTTPS certificates for `*.WORKSPACE_DOMAIN` at the frontend. The app rejects placeholder secrets, the default database password, HTTP frontend origins, and wildcard CORS in production. Never print or commit production connection strings or secrets.

For an existing installation, the Alembic revisions add workspace ownership and the older chat, document, and profile fields while keeping existing records. Review and rehearse them against a database copy before using them for a customer deployment. Database schema changes run through Alembic before startup. Startup idempotently upserts the workspace action and module permission catalog, seeds protected owner access, and backfills module grants once from existing action grants without changing existing custom role actions.

Workspace module access uses separate permission codes such as `modules.tasks.access`. API requests require both the relevant module grant and the existing action permission. Platform Super Admin endpoints use their own account table and authentication flow and are excluded from workspace module checks.

## Coolify + Nixpacks deployment

This repository keeps the API under `backend/`. For a Coolify application deploying this API with Nixpacks, configure the source repository and intended deployment branch, set **Base Directory** to `/backend`, select **Nixpacks**, and expose container port **8000** for the API domain. The included `nixpacks.toml` starts the served application as `app.main:app` and listens on `$PORT` (falling back to `8000`). In Coolify, confirm the detected Start Command is `uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}` or set that exact Start Command. Do not set the health check or proxy target to the public TLS port; Traefik terminates HTTPS and forwards to the container's port 8000.

Set these non-secret backend values in Coolify:

```env
APP_ENV=production
PUBLIC_APP_URL=https://pms.knowletive.in
WORKSPACE_DOMAIN=knowletive.in
ALLOW_ORIGINS=https://pms.knowletive.in
DEBUG=False
```

Also configure a valid production `DATABASE_URL`, a unique `SECRET_KEY` of at least 32 characters, and the SMTP settings required by workspace registration. Registration sends email verification; the service returns 503 if email delivery is not configured. Do not commit these secrets.

For the frontend deployment, set `NEXT_PUBLIC_API_URL=https://pms-backend.knowletive.in/api/v1` and `NEXT_PUBLIC_WORKSPACE_DOMAIN=knowletive.in` as build-time variables, then rebuild and redeploy the frontend. Next.js embeds `NEXT_PUBLIC_*` variables into its browser bundle at build time.

After deployment, verify `https://pms-backend.knowletive.in/health` returns HTTP 200. Then send an `OPTIONS` request to `/api/v1/organizations/register` with `Origin: https://pms.knowletive.in`, `Access-Control-Request-Method: POST`, and `Access-Control-Request-Headers: authorization,content-type`. A healthy backend should return a successful preflight with `Access-Control-Allow-Origin: https://pms.knowletive.in`. A `503 no available server` is a Coolify/container/Traefik availability or port-routing failure that happens before FastAPI CORS; inspect the deployment logs, running state, and internal port mapping first.
