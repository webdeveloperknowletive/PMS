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
