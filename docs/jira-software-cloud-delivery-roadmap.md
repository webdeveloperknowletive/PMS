# SprintIX: Jira Software Cloud capability roadmap

## Product target

Match the day-to-day Jira Software Cloud experience for software delivery teams while keeping SprintIX branding and the existing workspace, role, and project data. Jira Service Management features such as customer request portals, queues, and SLAs are outside this target unless separately requested.

The comparison includes Jira Software Cloud features available on different plans. Each SprintIX capability still needs its own authorization, tenant-scoping, API, UI, migration, and acceptance tests before it is considered complete.

## Delivery sequence

### 1. Navigation and core work experience

- [x] Neutral, compact workspace shell with a light project navigation rail and blue primary actions.
- [x] Global Create action opens the existing task form when the user has task creation access.
- [x] Offer Epic, Story, Task, Bug, and Spike in the task creation form; create Subtask from a parent task.
- [x] Open tasks and stories, users, user permissions, projects, and teams in dedicated pages from their primary lists and actions.
- [ ] Move remaining large editor dialogs (Kanban card details, workflow, milestones, Gantt, reports, documents, and administration) to dedicated pages while preserving their specialized actions.
- [ ] Project-specific navigation with Overview, Backlog, Board, List, Timeline, Releases, Reports, and Settings tabs.
- [ ] Collapsible and customizable sidebar, recent work, and starred projects, boards, and filters.
- [ ] Shared work item detail layout with consistent activity, comments, attachments, links, subtasks, and field panels.
- [ ] Unified task key presentation and direct URLs throughout search, boards, reports, and notifications.
- [ ] Keyboard, touch, responsive, and screen-reader verification for each new work view.

### 2. Project configuration and issue management

- [ ] Configurable work item types and hierarchy rules.
- [ ] Field layouts and required fields by project and work item type.
- [ ] Project templates that include workflows, issue types, custom fields, boards, and optional sample work.
- [ ] Workflow editor with drafts, validation, publication, and version history.
- [ ] Mentions, watchers, and targeted notification subscriptions.
- [ ] More bulk actions, including status, sprint, labels, component, release, and move or copy between projects.
- [ ] Manual work logs, corrections, remaining effort, and time reports.

### 3. Search, boards, and dashboards

- [ ] Advanced structured task search with AND/OR grouping, field operators, date expressions, sorting, and safe server-side execution.
- [ ] Saved and shared queries, permission-filtered results, and export.
- [ ] Saved board views, quick filters, card layouts, and additional swimlane/grouping options.
- [ ] Customizable dashboard layouts and widgets driven by saved queries and reports.
- [ ] Personal and team notification preferences and digests.

### 4. Software delivery integration and automation

- [ ] GitHub, GitLab, and Bitbucket connections for branches, commits, pull requests, and review status linked by task key.
- [ ] Build and deployment signals linked to tasks and releases.
- [ ] Integration connection management, secrets storage, retries, and failure monitoring.
- [ ] Rule automation with triggers, conditions, actions, permissions, loop protection, and execution history.
- [ ] Outbound webhooks and a documented integration API.

### 5. Portfolio and advanced planning

- [ ] Cross-project timeline with releases, initiatives, dependencies, and milestones.
- [ ] Team capacity planning and scenario comparison.
- [ ] Cross-project dependency risk and schedule impact.
- [ ] Portfolio roll-ups for progress, delivery risk, and release forecasts.
- [ ] Report definitions and export formats aligned with the new planning model.

## Existing foundations to retain

SprintIX already has workspace permissions, projects and teams, backlog and sprints, Kanban with WIP limits, custom fields, releases, task links and attachments, Gantt, calendar, work sessions, and sprint metrics. Reuse those persisted models and APIs where possible. Do not mark a capability complete solely because a screen or API route exists.

## Release gates

For each slice: validate tenant and project visibility, permission combinations, data migration and rollback, keyboard and touch interactions, API and UI behavior, and a production frontend build. Update the comparison after every completed slice so this roadmap reflects the current code.
