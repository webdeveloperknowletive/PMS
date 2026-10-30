# SprintIX workspace onboarding

## Customer flow

1. A company owner opens **Create a workspace** and enters their name, work email, password, company name, workspace address, and terms acceptance.
2. SprintIX reserves the workspace slug and creates that company's workspace, a trial subscription record, workspace roles, permissions, and the first account. The slug is used as the workspace subdomain. The frontend reads the slug from its host, carries it into sign-in, and the backend checks that the account belongs to that workspace.
3. That first account is always **Workspace Owner**. Public signup cannot choose an employee role.
4. The owner verifies the email, signs in, can update company details from **Organization**, creates a project, and invites employees from **Users**.
5. For each employee, an authorized person enters the email and chooses one of that workspace's roles. The invite link is single-use and expires after 72 hours. Accepting it consumes the link; afterward the employee signs in. Resending an unaccepted invitation issues a fresh link and invalidates the previous one.
6. The employee opens the invitation, creates a password, and joins the workspace with the selected role. The employee cannot select or change the role during acceptance.
7. The owner or an authorized administrator can see invitation status, resend an active or expired invitation, or revoke a pending invitation. Resending rotates the one-time token so the old link stops working. Active employees are managed in the existing Users, Roles, and Permissions screens.

## Roles and access

The workspace begins with editable role copies based on SprintIX defaults: Workspace Owner, Admin, Project Manager, Team Lead, Developer, Tester, and Viewer. Each workspace owns its copies of roles and permission grants. Workspace Owner is protected from deletion, renaming, permission changes, invitation assignment, account deactivation, and role removal. A formal ownership-transfer screen is still needed before customers can hand the workspace to another person. Other role access is managed through **Roles & Permissions**.

### Seeded role and permission profiles

The database also contains the private platform role **Super Admin**, so a newly initialized workspace has eight role records in total. Super Admin is never shown in employee invitations. Workspace Owner is also excluded from invitations because it is reserved for the account that created the workspace.

| Role | Permission profile | Invitation selectable |
| --- | --- | --- |
| Super Admin | Full permission catalog across the platform; private platform operator role | No |
| Workspace Owner | Full permission catalog for the workspace; protected from role and account removal | No |
| Admin | Full permission catalog, including users, invitations, roles, and role permissions | Yes |
| Project Manager | Project, team, task, sprint, workflow, Kanban, Gantt, milestone, calendar, document, report, chat, and AI permissions; excludes role administration and direct user-permission administration | Yes |
| Team Lead | View access plus team delivery, task, Kanban, workflow, Gantt, milestone, calendar, document, report, chat, and AI delivery permissions | Yes |
| Developer | View access plus assigned-task updates, task creation, comments, work sessions, Kanban movement/card creation, document upload/create, and chat participation | Yes |
| Tester | View access plus assigned-task updates, comments, work sessions, Kanban movement, document upload/create, and chat participation | Yes |
| Viewer | Read-only `*.view` permissions | Yes |

These are editable workspace role copies. Administrators can adjust the permission grants from **Roles & Permissions** after initialization; the invitation selector intentionally offers only the six non-system employee roles.

### Module access and action permissions

Workspace permission catalogs contain two distinct kinds of grants. `modules.<module>.access` controls whether a role can see and open a workspace module. Existing action grants such as `tasks.create`, `projects.view`, and `users.update` continue to control API operations inside that module. Enabling a module does not grant its actions, and retaining actions while disabling the module does not make the module available. The role editor shows both sets separately. Effective module access includes role grants and direct user permission grants, and the API checks module access in addition to each endpoint's action permission. Personal account settings and the platform Super Admin area remain outside workspace module navigation and grants.

On startup, the permission catalog is safely upserted for every workspace. Existing roles receive only the new module grants that correspond to action permissions they already have, plus the dashboard landing grant; existing action grants, custom roles, users, and assignments are not replaced. This backfill can run repeatedly.

## Workspace data separation

Application records now carry a workspace ID, and authenticated ORM queries and writes are scoped to the signed-in user's workspace. Applying the Alembic workspace migration assigns existing records to `existing-workspace`. The invitation token is stored as a hash. This is the initial single-workspace-per-account implementation: a person with an existing SprintIX account cannot yet join a second company workspace. Supporting outside consultants or users who belong to multiple companies needs a separate organization-membership model and workspace switching.

## Local setup

- Copy `backend/.env.example` to `backend/.env` and fill in the database and application settings.
- Set `PUBLIC_APP_URL` to the frontend's actual local address (currently `http://localhost:3000`) so copied and emailed invitations open the running app. Keep the API on port 8000.
- From the `backend` directory, apply the versioned workspace migrations with `alembic upgrade head` before starting the API. Back up an existing database first.
- Configure SMTP values to send verification and invitation emails. In local development, verification and invitation links can be copied from the app when email is not configured.
- Set `WORKSPACE_DOMAIN` in the backend `.env` and `NEXT_PUBLIC_WORKSPACE_DOMAIN` in the frontend environment to the same host, without a scheme or path. Local links use `localhost:3000/login?workspace_slug=acme` so they work on Windows without local DNS changes.
- For production, point wildcard DNS (`*.yourdomain.com`) and HTTPS certificates at the frontend, set `WORKSPACE_DOMAIN=yourdomain.com`, and set `NEXT_PUBLIC_WORKSPACE_DOMAIN=yourdomain.com`. The backend accepts the base app origins listed in `ALLOW_ORIGINS` and workspace subdomains under that configured domain.

## Before public sale

This work establishes onboarding and workspace separation, but it does not make SprintIX ready to take payments or claim full commercial readiness. Before public launch:

- Review and rehearse both Alembic revisions on a copy of customer data before production. The legacy chat, document, profile, and organization settings schema changes are now versioned; startup only seeds legacy workspace role data.
- Configure production SMTP, verified sending domain, HTTPS, secrets, backups, and monitoring.
- Connect a billing provider for checkout, invoices, subscription webhooks, failed-payment handling, and plan limits. The database currently records a trial; it does not charge customers.
- Publish company-approved Terms of Service and Privacy Policy. The signup terms link must point to those reviewed legal documents before launch.
- Add rate limits and bot protections to public signup, email resend, and invitation acceptance routes.
- Review every API endpoint, websocket, and file operation for workspace scoping. Add automated tenant-isolation, role-escalation, invitation expiry/replay, and upgrade tests before enabling open registration.
- Add membership-based accounts if one person must join more than one customer workspace.

Existing SprintIX project-management modules and routes remain in place; this work adds the customer signup, invitation, and workspace boundary around them.
