# Enterprise Project Management Development Plan

## Goal

Grow the existing project management system for IT delivery companies without replacing its current modules or adding unnecessary architecture. Keep the backend as a modular FastAPI application and extend its existing PostgreSQL data model in small, reviewable steps.

## Product shape

Use this relationship as the starting point:

```text
SaaS workspace (one subscribing IT company)
└── IT company organization
    ├── Employees and internal teams
    ├── Client accounts
    │   └── Projects
    │       ├── Project memberships and delivery teams
    │       ├── Work items and workflow
    │       └── Milestones, documents, reports, and client decisions
    └── Portfolios
```

An employee can belong to more than one team or project. A client user is attached to a client account and receives access only to projects explicitly shared with that client. A tenant is the subscribing company's workspace; a client account is that company's customer relationship. These are different concepts.

## Existing work to preserve

Keep these current backend modules and build on them:

- Identity and access: `auth`, `users`, `roles`
- Delivery structure: `teams`, `projects`, `tasks`
- Planning: `workflow`, `kanban`, `gantt`, `milestones`, `calendar`
- Collaboration and visibility: `documentation`, `notifications`, `reports`
- Assistance: AI modules for sprint planning, risk prediction, document generation, task estimation, and meeting summaries

Keep the seeded role names `Admin`, `Project Manager`, `Team Lead`, `Developer`, `Tester`, and `Viewer` as compatible presets. Add new capabilities and scopes around them rather than renaming or removing them.

### Workspace role access model

Workspace module visibility is controlled by workspace-scoped `modules.<module>.access` permission records stored in the existing permission catalog and assigned through `RolePermission` or `UserPermission`. These module grants are independent of action grants such as `tasks.create`: opening a module does not automatically permit actions, and action grants do not bypass a missing module grant. The workspace role editor manages both sets. Frontend navigation and route guards use effective grants, while backend endpoints require the module grant and their existing action grant. Platform Super Admin accounts and routes use their separate authentication and are not part of this workspace permission catalog. Existing workspaces are backfilled idempotently from their current action grants without replacing custom role configurations.

## Development phases

### Phase 0: Protect the current application

1. Preserve the current working tree and its uncommitted files.
2. Record which database tables exist and how the current database was created.
3. Establish an Alembic migration baseline before creating production data migrations. The repository currently has Alembic configuration but no revision files.
4. Document the current API and schema behavior for users, roles, projects, teams, and tasks.

**Exit condition:** a migration can be applied to both an existing development database and a clean database without deleting or losing current project data.

### Phase 1: Organization, client account, and membership foundation

1. Add an organization/workspace record for the subscribing IT company.
2. Add client accounts under the organization.
3. Add organization membership and project membership as explicit relationships.
4. Add scoped role assignments while retaining existing role names as presets.
5. Associate existing projects and users with a default organization through a reviewed data migration.
6. Add service-layer access checks and scope-filtered list/detail queries before exposing client users.

**Exit condition:** an employee sees only projects they can access, and a client user sees only explicitly shared projects in their client account. Existing employees and projects continue to work after migration.

### Phase 2: Role-aware dashboards

Use one dashboard framework with reusable widgets. Start with six layouts: Platform Operations, Organization Admin, Portfolio, Project Delivery, Team Delivery, and Client Portal. Add employee, Product Owner, QA, and release-focused saved layouts using the same widgets when the core views work.

**Exit condition:** each dashboard uses server-authorized data and supports drill-downs without leaking data across organizations or clients.

### Phase 3: Task lifecycle and workflow governance

1. Keep the existing task and workflow modules.
2. Define a standard default task workflow, with optional review and approval steps by task type and project policy.
3. Record status transitions and their actor, timestamp, and reason.
4. Represent blocked work with a reason and owner; record reopening as a transition.
5. Add controlled workflow configuration and versioned publishing after the default flow is stable.

**Exit condition:** tasks have a clear owner and history, teams can configure an approved workflow, and project reports derive status from consistent workflow data.

### Phase 4: Team-to-team delivery

Add explicit task dependencies, blocker escalation, decision records, and cross-team handoffs. Use the current Teams, Tasks, Notifications, Calendar, and Reports modules as the interaction points.

**Exit condition:** the dependent team and project manager can see the dependency owner, required date, state, and next action.

### Phase 5: Client delivery controls

Add client-visible request intake, scope/change requests, milestone review, acceptance records, and a clear separation between internal notes and shared content. Add budget, time tracking, or service-level agreements only if the target clients require them.

**Exit condition:** clients can make decisions and review agreed outcomes without seeing internal-only project information.

### Phase 6: Enterprise operations

Add enterprise identity integrations, access reviews, audit export, retention and deletion controls, backup/restore procedures, integration monitoring, and measured nonfunctional requirements.

**Exit condition:** enterprise operational and security requirements can be demonstrated and maintained.

## First implementation slice

The first code slice is Phase 1, but it begins with a database-baseline review. The current role assignment table is global (`user_role`) and project list/detail queries are not filtered by project membership. Adding a membership table without enforcing it in the API would create a false sense of security, so the first slice must include the data model, migration/backfill, and service-layer scope checks together.

### First-slice acceptance criteria

- Existing Admin, Project Manager, Team Lead, Developer, Tester, and Viewer assignments remain valid.
- Existing users and projects receive a reviewed default organization assignment.
- A user cannot read, update, or delete a project outside their permitted organization/project membership.
- List, detail, related task, report, document, and notification reads apply the same scope rules before client users are enabled.
- The migration preserves existing records and can be rolled back safely in development.
- Platform Super Admin is distinct from customer Organization Admin.

## Clean-code rules for each slice

- Keep route handlers small; put validation and business rules in the existing service layer and database queries in repositories.
- Use clear names based on business concepts: organization, client account, project membership, and scoped role.
- Make authorization checks explicit and reusable. Do not hide the only access check in frontend components.
- Add one small module at a time and register its router/model in the existing application structure.
- Keep migrations small, reversible where practical, and accompanied by a data-preservation plan.
- Preserve current behavior unless a change is required for the new scoped-access rule; call out any required API behavior change.
- Avoid adding microservices, a new permission framework, HR functionality, or billing unless a concrete requirement needs it.

## Current repository note

The working tree already contains numerous local changes, including frontend file deletions and newly added frontend files, modified AI sources, generated documents, and changed Python cache/log files. Preserve these files and review them separately before broad cleanup or refactoring. The implementation plan is additive and does not authorize reverting them.
