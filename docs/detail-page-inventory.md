# Detail page inventory

The application has **25 record types** that warrant a dedicated detail view. Epic, Story, Task, Bug, Spike, and Subtask are one work-item type with one shared route. Configuration dashboards, audit entries, notifications, and chat messages are not counted as separate editable records.

| # | Record type | Detail route | Editing |
|---|---|---|---|
| 1 | Work item (Epic, Story, Task, Bug, Spike, Subtask) | `/tasks/[taskId]` | Inline fields, checklist, people, attachments |
| 2 | Project | `/projects/[projectId]` | Inline fields and membership |
| 3 | Team | `/teams/[teamId]` | Inline fields and members |
| 4 | User | `/users/[userId]` | Inline profile and status; access on child page |
| 5 | Role | `/roles/[roleId]` | Inline fields and permission toggles |
| 6 | Workflow | `/workflow/[workflowId]` | Inline fields and transitions |
| 7 | Milestone | `/milestones/[milestoneId]` | Inline fields |
| 8 | Calendar event | `/calendar/[eventId]` | Inline fields for manual events |
| 9 | Document or resource | `/documentation/[documentId]` | Inline metadata for editable resources |
| 10 | Report | `/reports/[reportId]` | Inline status and file URL; generated metadata is fixed |
| 11 | Scheduled work item | `/gantt/[ganttId]` | Inline schedule fields |
| 12 | Sprint | `/projects/[projectId]/sprints/[sprintId]` | Inline fields |
| 13 | Goal | `/projects/[projectId]/goals/[goalId]` | Inline fields |
| 14 | Release | `/projects/[projectId]/releases/[releaseId]` | Inline fields |
| 15 | Component | `/projects/[projectId]/components/[componentId]` | Inline fields |
| 16 | Board column | `/kanban/columns/[columnId]` | Inline fields |
| 17 | Custom field definition | `/projects/[projectId]/fields/[fieldId]` | Read only; backend supports create/delete, not update |
| 18 | Board label | `/kanban/labels/[labelId]` | Inline name and color |
| 19 | Workspace organization | `/organization` | Inline name and slug |
| 20 | Platform organization | `/platform/organizations/[organizationId]` | Inline status; other data is read only |
| 21 | AI sprint plan | `/ai/sprint-planning/[recordId]` | Inline fields and apply action |
| 22 | AI task estimate | `/ai/task-estimation/[recordId]` | Inline fields and apply action |
| 23 | AI risk prediction | `/ai/risk-prediction/[recordId]` | Inline fields |
| 24 | AI meeting summary | `/ai/meeting-summary/[recordId]` | Inline fields and apply action |
| 25 | AI generated document | `/ai/doc-generator/[recordId]` | Read only; backend supports save/publish, not update |

The shared field control shows a pencil on hover or keyboard focus, opens an editor in place, and supports Save/Cancel, Enter/Escape, validation, and API error feedback. Permission checks suppress editing controls for viewers. Create flows and destructive confirmations are separate from record details.
