/**
 * Mirrors app/core/permissions.py EXACTLY — same role names, same tier
 * groupings. If the backend's tiers ever change, this file must change
 * too, or the frontend will show/hide the wrong buttons relative to what
 * the backend actually allows. This file only controls UI visibility —
 * the backend (see every module's permissions.py, wired into its router)
 * is what actually enforces access. This file existing does not replace
 * that; it's a convenience layer so the UI doesn't show buttons that
 * would just 403 anyway.
 */

export const ROLE_NAMES = {
  ADMIN: "Admin",
  PROJECT_MANAGER: "Project Manager",
  TEAM_LEAD: "Team Lead",
  DEVELOPER: "Developer",
  TESTER: "Tester",
  VIEWER: "Viewer",
} as const;

export const ALL_ROLES = Object.values(ROLE_NAMES);

// Mirrors MANAGEMENT_ROLES in core/permissions.py
export const MANAGEMENT_ROLES: string[] = [ROLE_NAMES.ADMIN, ROLE_NAMES.PROJECT_MANAGER];

// Mirrors DELIVERY_LEAD_ROLES
export const DELIVERY_LEAD_ROLES: string[] = [ROLE_NAMES.ADMIN, ROLE_NAMES.PROJECT_MANAGER, ROLE_NAMES.TEAM_LEAD];

// Mirrors CONTRIBUTOR_ROLES
export const CONTRIBUTOR_ROLES: string[] = [
  ROLE_NAMES.ADMIN,
  ROLE_NAMES.PROJECT_MANAGER,
  ROLE_NAMES.TEAM_LEAD,
  ROLE_NAMES.DEVELOPER,
  ROLE_NAMES.TESTER,
];

// Mirrors READ_ONLY_ROLES
export const READ_ONLY_ROLES: string[] = [ROLE_NAMES.VIEWER];

function hasAny(myRoles: string[], allowed: string[]): boolean {
  return myRoles.includes(ROLE_NAMES.ADMIN) || allowed.some((r) => myRoles.includes(r));
}

export interface Capabilities {
  isAdmin: boolean;
  // Mirrors can_manage_projects / can_manage_teams
  canManageProjects: boolean;
  // Mirrors tasks.can_manage_tasks (create/reassign/delete). Per-task
  // "can I edit THIS task" additionally depends on assignment — see
  // canUpdateTask() below, which needs the specific task's assignee.
  canManageTasks: boolean;
  // Mirrors milestones.can_manage_milestones
  canManageMilestones: boolean;
  // Mirrors workflow.can_manage_workflows
  canManageWorkflow: boolean;
  // Mirrors kanban.can_manage_board (columns) — dragging cards uses
  // canMoveKanbanCard below since that's Contributor-tier, not this.
  canManageKanbanBoard: boolean;
  canMoveKanbanCard: boolean;
  // Mirrors gantt.can_manage_schedule
  canManageGantt: boolean;
  // Mirrors documentation.can_upload_documents / can_delete_documents
  canUploadDocuments: boolean;
  canDeleteDocuments: boolean;
  // Mirrors calendar.can_create_event (open to all) — editing/deleting a
  // specific event additionally depends on being its organizer, see
  // canModifyEvent() below.
  canCreateEvent: boolean;
  // Mirrors reports.can_manage_reports
  canManageReports: boolean;
  // Mirrors roles.can_manage_roles / users.can_manage_users
  canManageRoles: boolean;
  canManageUsers: boolean;
  // Mirrors every AI module's can_generate
  canUseAI: boolean;
}

export function getCapabilities(roleNames: string[]): Capabilities {
  const isAdmin = roleNames.includes(ROLE_NAMES.ADMIN);
  return {
    isAdmin,
    canManageProjects: hasAny(roleNames, MANAGEMENT_ROLES),
    canManageTasks: hasAny(roleNames, DELIVERY_LEAD_ROLES),
    canManageMilestones: hasAny(roleNames, DELIVERY_LEAD_ROLES),
    canManageWorkflow: hasAny(roleNames, DELIVERY_LEAD_ROLES),
    canManageKanbanBoard: hasAny(roleNames, DELIVERY_LEAD_ROLES),
    canMoveKanbanCard: hasAny(roleNames, CONTRIBUTOR_ROLES),
    canManageGantt: hasAny(roleNames, DELIVERY_LEAD_ROLES),
    canUploadDocuments: hasAny(roleNames, CONTRIBUTOR_ROLES),
    canDeleteDocuments: hasAny(roleNames, DELIVERY_LEAD_ROLES),
    canCreateEvent: roleNames.length > 0, // any authenticated user, matches can_create_event
    canManageReports: hasAny(roleNames, DELIVERY_LEAD_ROLES),
    canManageRoles: isAdmin,
    canManageUsers: isAdmin,
    canUseAI: hasAny(roleNames, DELIVERY_LEAD_ROLES),
  };
}

/** Mirrors tasks.can_update_task — Delivery Lead can edit any task; a Developer/Tester only their own. */
export function canUpdateTask(taskAssigneeId: string | null | undefined, currentUserId: string, roleNames: string[]): boolean {
  if (hasAny(roleNames, DELIVERY_LEAD_ROLES)) return true;
  return taskAssigneeId === currentUserId;
}

/** Mirrors teams.can_manage_team_membership — Delivery Lead can manage any team; a Team Lead only their own team. */
export function canManageTeamMembership(teamLeadUserId: string, currentUserId: string, roleNames: string[]): boolean {
  if (hasAny(roleNames, MANAGEMENT_ROLES)) return true;
  return teamLeadUserId === currentUserId;
}

/** Mirrors calendar.can_modify_event — Delivery Lead can edit any event; anyone else only their own. */
export function canModifyEvent(organizerId: string | null | undefined, currentUserId: string, roleNames: string[]): boolean {
  if (hasAny(roleNames, DELIVERY_LEAD_ROLES)) return true;
  return organizerId === currentUserId;
}

/** Mirrors notifications.can_access_notification — owner or Admin only. */
export function canAccessNotification(notificationOwnerId: string, currentUserId: string, roleNames: string[]): boolean {
  return roleNames.includes(ROLE_NAMES.ADMIN) || notificationOwnerId === currentUserId;
}

/** Mirrors users.can_modify_user — self or Admin only. */
export function canModifyUser(targetUserId: string, currentUserId: string, roleNames: string[]): boolean {
  return roleNames.includes(ROLE_NAMES.ADMIN) || targetUserId === currentUserId;
}