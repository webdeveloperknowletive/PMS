# Jira Trello feature parity review

## Scope and reading guide

This review compares the Jira and Trello patterns in the supplied feature guide with the current SprintIX repository. “Available” means there is a user-facing path and persisted behavior in the application. “Partial” means a related module or data exists, but an important part of the described workflow is missing or incomplete. “Missing” means no implementation was found in the current source tree. This is a repository review; it does not certify deployed behavior, security, performance, or production readiness.

The guide is a product blueprint, not a set of instructions to copy Jira or Trello screen-for-screen. Keep the existing SprintIX logo, accounts, and seeded role names while implementing the items below.

## Feature comparison

| Guide capability | Status | SprintIX evidence or gap |
|---|---|---|
| Workspace and organization boundary | Available | Workspace onboarding, organization settings, and organization-scoped ORM data are present. |
| Project creation and project setup | Partial | Projects receive a stable workspace-unique key and guided setup offers built-in and user-saved starter-board presets while creating the team and default workflow; templates for full project details and sample-data onboarding remain missing. |
| Goals, initiatives, and portfolio roll-up | Partial | Projects support goals with task-derived progress, workspace-user ownership, success measures, same-project parent/initiative links, and a permission-scoped cross-project roll-up; portfolio planning and roll-up of parent goals remain missing. |
| Work-item types and parent/child hierarchy | Partial | Tasks support Epic, Story, Task, Bug, Spike, and Subtask types; configurable types, field layouts, and richer hierarchy constraints are still missing. |
| Task detail, estimates, due dates, and checklists | Partial | Task fields, story points, due date, checklists, reusable project components, project-defined custom fields, and validated labels are persisted; reporter/environment data and configurable field layouts remain missing. |
| Backlog ranking and inline intake | Available | The task page has a durable per-project To Do backlog, quick inline task intake, and audited one-step reordering; the project sprint/backlog view can group by epic or release. |
| Typed dependencies and issue links | Partial | Task details support blockers, related work, and duplicate links, with project boundaries and blocking-cycle checks; blocker owners are assignable, scheduled relationships appear in Gantt, and Blocked work includes a paginated cross-project dependency view with search, project, owner, and overdue filters. A cross-project Gantt roadmap remains. |
| Components, releases, and versions | Available | Projects have reusable components and releases/versions with status, due date, task counts, task filters, and release-scope history that records baseline, added, and removed tasks, including removal on release deletion. |
| Configurable workflows and transitions | Partial | Workflow administration remains basic; server-side task transitions now enforce a defined status graph, management/reviewer conditions, and append-only structured status history. Per-project editable transition graphs remain missing. |
| Scrum sprint planning and execution | Partial | Sprint records and AI planning exist, and project work shows capacity, scope-at-start, added/removed points, and persisted scope changes; structured status history is now available, but historical burndown and velocity calculations are not implemented. |
| Kanban boards and card movement | Available | Kanban module and task placement support board movement. |
| WIP limits, swimlanes, and board filters | Partial | Optional per-column WIP limits are validated, enforced on placement and moves, and displayed with active-task counts. The board filters by text, priority, assignee, component, release, epic, sprint, and label and groups cards into assignee or priority lanes; grouping by epic or sprint and saved board filter/grouping presets remain missing. |
| Roadmap and timeline | Partial | Gantt/timeline exists; cross-project roadmap themes and dependency-aware portfolio roadmap are missing. |
| Comments, mentions, and watchers | Partial | Task comments and notifications exist; mention parsing/authorization and watcher subscriptions were not found. |
| Attachments and linked work resources | Partial | Documentation and chat attachment paths exist; secure attachments directly associated with tasks/cards were not found. |
| Checklists and subtasks | Available | Checklist data and subtask relationships are present. |
| Task activity history | Available | Task activity events are persisted and displayed. |
| Organization-wide durable audit trail | Partial | Authenticated API write events are persisted, organization-scoped, filterable by method and date, visible to workspace administrators, and exportable to CSV (up to 10,000 events); read events, retention controls, and database-level tamper protection are not present. |
| Development links and CI/CD signals | Missing | No repository, commit, pull request, build, or deployment integration was found. |
| Time estimates and work logs | Partial | Story points and shared work sessions/time reporting exist; manual work-log entries and remaining-effort tracking are not evident. |
| Search and saved filters | Partial | Server-side search covers tasks, projects, goals, releases, documents, reports, people, visible calendar events, member-only chat messages, and admin audit events; users can save personal/shared task filters including component and release. Search result navigation is still module-level for events and audit records. |
| Configurable dashboards and widgets | Partial | The dashboard aggregates current modules; user-configurable layouts/widgets and saved dashboard views are not evident. |
| Agile and flow reports | Partial | Reports exist; burndown, velocity, cumulative flow, control/cycle-time, throughput, and documented metric definitions need completion. |
| Rule-based automation and execution log | Missing | Notifications and automatic calendar entries exist, but a configurable trigger/condition/action rule engine is not present. |
| Notification preferences and digests | Partial | In-app notifications exist; full per-event preferences, quiet hours, digest scheduling, and push delivery need completion. |
| Workspace, board, list, and card model | Partial | Projects and Kanban boards/cards exist; a separate Trello-style workspace-board-list-card model is not evident. |
| Custom lists, reorder/archive/restore | Partial | Kanban columns provide workflow stages; arbitrary list semantics, list archive/restore, and board backgrounds/covers are not evident. |
| Quick capture, copy, and move cards | Partial | Inline backlog intake and board quick-add exist, and cards have a touch/keyboard move-to-column control; copy semantics and a full cross-board move flow remain missing. |
| Table/list view and bulk editing | Partial | Tasks have a table/list page and managers can update priority, assignee, and set or clear due dates for up to 100 selected tasks at once; bulk edits for other fields remain. |
| Calendar and timeline views | Available | Calendar and Gantt routes are present. |
| Workspace administration and role permissions | Available | Roles/permissions and organization administration are present. |
| Mobile and touch use | Partial | Responsive layouts, mobile navigation, installable PWA metadata, and a card-level move-to-column control are available; offline use, native clients, and page-by-page touch review remain open. |
| Keyboard and assistive-technology access | Partial | Semantic controls, focus styling, and a keyboard-accessible move-to-column control are available; a full keyboard and screen-reader audit is outstanding. |
| Export and extension ecosystem | Partial | Report/export helpers exist; a stable integration API, webhooks, and extension lifecycle are missing. |

## Work completed with this review

Task create/update validation trims titles, descriptions, comments, and checklist labels, rejects blank required text and descriptions longer than 10,000 characters, and restricts status and priority to values supported by the current task workflow. The task list endpoint also supports server-side text, project, assignee, status, priority, overdue, due-date, and blocked-work filters while retaining its existing permission-scoped query.

The task create/edit assignee picker lists active workspace Developers and Testers, and shows each role beside the person's name. Team Leads only receive candidates on their assigned project teams; users without a team can be assigned by workspace administrators or project managers without automatically joining a team.

Project create/update validation trims and bounds project names, prevents clearing required project fields, and checks the merged start and due dates when only one date is changed.

Sprint names and goals are trimmed and length-bounded; sprint, goal, and release updates reject null values for required names and statuses while still allowing their optional descriptions and dates to be cleared.

Task managers can select up to 100 visible tasks and apply one priority in a single request. The operation respects each selected task's visibility, records a task activity for every changed priority, and refreshes the task, calendar, Kanban, and audit views.

Task managers can assign up to 100 selected tasks to an active user in the same workspace. Existing team membership and team-lead assignment rules are enforced per task; unassign is offered only when every selected task has no team assignment. Changes record task activity, refresh deadline calendar ownership and related task views, and notify the new assignee. The organization audit trail records the bulk action without storing request bodies.

Blocked work now has a permission-scoped, searchable and paginated dependency list across the user's accessible projects, filterable by project, blocker owner (including unassigned), and overdue target date. The dashboard blocker count and dependency list no longer stop at the first 500 tasks or 20 relationships. Task and board status changes, dependency edits, and owner changes refresh the list.

The Kanban board can group cards into assignee or priority lanes inside each status column. Active filters or grouping pause drag-and-drop; clearing the view restores position-safe card movement. A card-level move-to-column selector provides a touch and keyboard alternative to dragging and uses the same permission, review, status-mapping, and WIP-limit API checks. Board filters include text, priority, assignee, project component, release, and label.

Users can save, reuse, and delete personal task filter presets. Presets are scoped to their owner and workspace and retain the selected label, component, and release filters.

Project managers can create project goals, update their status, and link tasks to the goal. Goal progress is calculated from linked tasks and refreshes when task data changes. The Projects page rolls up goals from projects visible to the signed-in user.

Goals now have optional active workspace-user ownership, success measures, and a same-project parent initiative. Server validation rejects inactive or cross-workspace owners, cross-project parents, and parent cycles. Owners and hierarchy can be changed from the project page. Migration `20261018_14` adds nullable goal fields and foreign keys without changing existing goal records.

The task page now provides inline quick-add into a selected project and a Backlog view ordered by a persisted per-project rank. Managers and team leads can move an item up or down; task activity and the organization audit trail record those changes. Existing tasks receive a stable initial rank in the migration.

Projects now support reusable components. Project managers can create, rename, and remove components from the project page; tasks can link to a component, and both the task list and Kanban board can filter by component within a selected project. Deleting a component keeps its tasks and records the cleared link in each task's activity history. Additive migration `20261018_10` adds a component table and nullable task foreign key without rewriting existing task records.

Projects now have a stable uppercase key generated from their name, made unique within the workspace, and backfilled for existing projects. Keys are shown in project/task views and included in project search. Migration `20261018_17` adds the key without changing project names, users, logos, or existing project data.

The guided project setup offers three built-in starter board presets: Standard delivery, Simple flow, and Blocked work. Managers can save, reuse, and delete named workspace templates for those board presets. Creating a project from one still creates the team's current default workflow and columns. Templates for full project details and sample-data onboarding remain future work. Migration `20261019_22` adds the organization-scoped template table.

Task list and Kanban board filters now include project releases. Release cards distinguish completed and unresolved tasks; cancelled tasks are excluded from unresolved counts. Saved task filters also preserve the selected component and release. Migration `20261018_11` adds nullable references that clear automatically when the referenced component or release is removed.

Task types now include Spike for investigation work. Task creation, editing, Kanban quick-add, and backend validation use the same supported value; configurable work-item types remain a gap.

Tasks support up to 20 normalized, case-insensitive unique labels, each limited to 40 characters. Labels are editable, visible in task and board cards, filterable in task lists and Kanban, and retained by saved task filters. Activity records label changes without storing the label payload. Migration `20261018_13` adds default-empty task labels and an optional saved-filter label.

Project managers can define up to 25 task custom fields per project using text, number, date, single-select, or checkbox types. Required values, defaults, option sets, and field types are validated on the server; values are stored in a JSONB object keyed by field id. Task activity records field names changed without storing the field values. Removing a definition clears that field from affected tasks and records the cleanup. Migration `20261018_12` adds the definitions table and a default-empty task JSONB column.

The project sprint view reports current task completion, delivered and remaining story points, overdue active tasks, optional validated capacity, baseline points captured at sprint start, scope additions/removals, and the latest scope-change events. Daily burndown reconstructs membership, points, and status from scope and status history; ideal burn uses initial baseline points and the planned sprint end date. Cumulative flow counts scoped tasks by status. Throughput counts transitions into Done while tasks are in the sprint; cycle time is the elapsed time from the latest In Progress entry before a Done transition. Velocity reports delivered points at sprint completion and averages up to five recent completed sprints with recorded baselines. Members who cannot see the whole project receive results for their assigned tasks and that basis is labelled. Older completed sprints without a recorded baseline are omitted instead of presenting guessed history; legacy completion timestamps are approximated from the last sprint update. Migrations `20261018_15` and `20261018_16` add the scope and status history, and `20261019_19`/`20261019_20` record sprint lifecycle timestamps and start or select the latest available baseline.

Saved task filters can be shared with the workspace by managers. Other users can apply shared filters, while deletion remains limited to the filter owner.

Kanban columns support optional WIP limits, including whole-number validation, an active-task counter, and server-side checks on placement and moves. Migration `20261016_08` is applied to the local database. A fresh database backup was created before applying it.

The Kanban board supports search and priority, assignee, component, release, epic, sprint, and label filters, plus assignee and priority grouping. A label-only selection is applied correctly. Card dragging pauses while a filtered or grouped view is active, so a visible card index cannot accidentally overwrite the actual board order.

The project backlog/sprint view can group its existing tasks by direct epic parent or release, with an explicit “No epic” or “No release” group. Grouping is a view over existing tasks and does not change task or sprint data.

The header search now queries accessible tasks, projects, goals, releases, documents, reports, people, visible calendar events, messages from chats the user belongs to, and audit events for workspace administrators. Chat results open the matching conversation, and other results respect the signed-in user's organization and module access.

The web app has an installable PWA manifest and Apple web-app metadata using the existing SprintIX logo. The API now sends baseline browser security headers, with HSTS only for production HTTPS requests.

Task details support typed links for blockers, related work, and duplicates. Blocking cycles, cross-project links, self-links, and duplicate edges are rejected. Project releases can be planned, status-tracked, and linked to tasks; release cards show task completion counts.

Gantt now displays project-scoped blocker relationships and their owners beside scheduled tasks. Workspace managers can assign an active project member to resolve a blocker, reassign or clear the owner, and the change is recorded in task activity and sent to the new owner as an in-app notification. Migration `20261016_09` adds the optional owner field after a fresh database backup.

The Work Overview dashboard counts visible tasks marked Blocked by task status or board column, or waiting on unfinished blocking work; it lists open dependency relationships with project and owner, and opens a task's dependency details when selected. Its count opens a matching Blocked work filter on the Tasks page. Creating or removing dependencies and task or board status changes refresh that summary.

Managers can set or clear due dates for up to 100 selected tasks in one action. Each changed task receives an activity entry and its deadline calendar event is refreshed. Setting a due date updates the Gantt end date; clearing it preserves any independently scheduled Gantt dates. Related task, calendar, Gantt, and audit data are refreshed. The local database is at migration `20261018_17`; each migration applied in this implementation was preceded by a custom-format database backup verified with `pg_restore --list`.

Task status changes now appear as explicit activity events, including changes caused by starting a work session. Work cannot be started for completed, cancelled, or review-pending tasks. Gantt date edits validate the combined date range, and schedule records are scoped to the signed-in organization; same-project dependency references reject self-links and cycles.

Task status changes now also write structured organization-scoped history with task, actor, timestamp, and before/after status. The status-history read path enforces the same task visibility checks. Database triggers reject updates and deletes of history rows. Service-layer transition rules reject unsupported status jumps, require management permission for exceptional transitions, and retain the existing assigned-Team-Lead review approval rule. Migration `20261018_16` adds the history table; per-project editable workflow graphs remain future work.

Project workflows now store a validated task status-transition graph. Workflow managers can edit the graph from the workflow form; the active default workflow for a project governs ordinary task status updates, Kanban moves that change status, and starting work sessions. Existing workflows receive the previous transition rules by default. Self-transitions and unknown statuses are rejected, and a project can have only one default workflow after a workflow is explicitly made default. Review approval and privileged manager override behavior remain enforced. Migration `20261019_18` adds the JSONB transition map.

Date validation now checks project, sprint, Gantt, and calendar ranges on both API create and update paths. Task due dates are validated against the project start date on create, edit, and bulk update; changing a project start date is rejected if it would put an existing task due date before the project. Calendar updates validate the merged existing and submitted time range and reject clearing required date fields.

Authenticated API write requests now create a durable, workspace-scoped audit event with the actor, role names, method, route, response status, and timestamp. Workspace administrators can review the events from **Audit Log** in the app and export up to 10,000 matching events to CSV. Both listing and export explicitly scope results to the administrator's organization; CSV values are escaped against spreadsheet formula injection. Request bodies and query strings are not stored. Login/bootstrap requests and read-only requests are not included, so this is a business-action audit trail rather than a record of every HTTP request.

Release scope history records a baseline for tasks already in a release and records task additions, moves, and removals with release/task name snapshots, actor, and timestamp. Deleting a task or release preserves the event; release history can be viewed per release or across the project, including after a release is deleted. Task activity also records release changes. Migration `20261019_21` adds the history table and backfills the current release scope.

## Remaining work, in practical order

1. Add templates for full project details and sample onboarding; backlog grouping by epic/release is available in the project work view.
2. Add a cross-project Gantt roadmap and epic/sprint Kanban swimlanes; save board filter/grouping presets using the existing permission-aware filter model.
3. Add watcher subscriptions, authorized mentions, and per-event notification preferences/digests.
4. Add secure task attachments, explicit development links/integrations, and manual work logs only where they fit current storage and time-reporting permissions.
5. Add configurable dashboard widgets and a limited safe automation rule set with dry runs, idempotency, retries, execution history, and loop protection.
6. Review accessibility and responsive behavior end to end; add audit retention/high-risk read controls, production rate limiting/monitoring, and backup/restore/migration rehearsal where applicable.

These are remaining gaps, not features implied to be complete. Infrastructure-dependent controls require deployment configuration in addition to repository changes.

## Security and reliability boundary

No application can be promised “errorless,” “bugless,” or “safe from hackers.” SprintIX already has password hashing, role permissions, workspace scoping, and request logging, but those controls do not establish enterprise security by themselves. Before production use, review every route and background job for tenant/role scoping, add rate limits and security monitoring, manage secrets and HTTPS, rehearse backups and migrations, and perform independent security testing. The repository’s existing setup notes also call out these launch requirements.

## Preserved assets

This review does not modify the existing logo or user records. Database changes should be additive and delivered through reviewed migrations with a backup and rehearsal plan.
