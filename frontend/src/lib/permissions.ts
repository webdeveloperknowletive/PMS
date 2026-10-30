/** UI capability helpers based on permission codes returned by the API. */
export interface Capabilities {
  isAdmin: boolean;
  canManageOrganization: boolean;
  canManageProjects: boolean;
  canManageTeams: boolean;
  canManageTasks: boolean;
  canManageMilestones: boolean;
  canManageWorkflow: boolean;
  canManageKanbanBoard: boolean;
  canMoveKanbanCard: boolean;
  canManageGantt: boolean;
  canUploadDocuments: boolean;
  canDeleteDocuments: boolean;
  canCreateEvent: boolean;
  canManageReports: boolean;
  canManageRoles: boolean;
  canManageUsers: boolean;
  canUseAI: boolean;
}

export function getCapabilities(codes: string[]): Capabilities {
  const has = (code: string) => codes.includes(code);
  const any = (...items: string[]) => items.some(has);
  return {
    isAdmin: has("roles.manage"),
    canManageOrganization: has("organizations.update"),
    canManageProjects: any("projects.create", "projects.update", "projects.delete"),
    canManageTeams: any("teams.create", "teams.update", "teams.delete", "teams.leads.create", "teams.leads.delete"),
    canManageTasks: any("tasks.create", "tasks.update", "tasks.delete", "tasks.sprints.create", "tasks.sprints.update", "tasks.sprints.delete"),
    canManageMilestones: any("milestones.create", "milestones.update", "milestones.delete"),
    canManageWorkflow: any("workflow.create", "workflow.update", "workflow.delete"),
    canManageKanbanBoard: any("kanban.columns.create", "kanban.columns.update", "kanban.columns.delete", "kanban.tasks.create", "kanban.tasks.delete"),
    canMoveKanbanCard: has("kanban.tasks.move"),
    canManageGantt: any("gantt.create", "gantt.update", "gantt.delete"),
    canUploadDocuments: any("documents.upload", "documents.create"),
    canDeleteDocuments: has("documents.delete"),
    canCreateEvent: has("calendar.create"),
    canManageReports: any("reports.create", "reports.update", "reports.delete"),
    canManageRoles: has("roles.manage"),
    canManageUsers: any("users.create", "users.update", "users.delete", "users.status.update", "users.password.update"),
    canUseAI: ["sprint_plans", "risk_predictions", "documentation", "task_estimations", "meeting_summaries"].some((resource) => has(`ai.${resource}.generate`)),
  };
}

export function canAccessModule(pathname: string, codes: string[]): boolean {
  if (pathname === "/settings") return true; // personal account settings
  const modules: Record<string, string> = {
    "/dashboard": "dashboard", "/projects": "projects", "/tasks": "tasks", "/teams": "teams",
    "/milestones": "milestones", "/calendar": "calendar", "/documentation": "documentation",
    "/workflow": "workflow", "/kanban": "kanban", "/gantt": "gantt", "/reports": "reports",
    "/ai": "ai_studio", "/notifications": "notifications", "/users": "users", "/roles": "roles",
    "/audit-logs": "audit_log", "/organization": "organization", "/platform": "platform",
  };
  const route = Object.keys(modules).find((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (!route) return true;
  const accessCode = `modules.${modules[route]}.access`;
  // Keep a safe home page when an administrator deliberately removes every
  // workspace module. It contains no permission bypass for module APIs.
  if (route === "/dashboard" && !codes.some((code) => code.startsWith("modules.") && code.endsWith(".access"))) return true;
  return codes.includes(accessCode);
}

export function canUpdateTask(assigneeId: string | null | undefined, userId: string, codes: string[]): boolean {
  return codes.includes("roles.manage") || codes.includes("tasks.update") || (codes.includes("tasks.update_assigned") && assigneeId === userId);
}

export function canManageTeamMembership(_leadId: string, _userId: string, codes: string[]): boolean {
  return codes.includes("roles.manage") || ["teams.members.create", "teams.members.update", "teams.members.delete"].some((code) => codes.includes(code));
}

export function canModifyEvent(organizerId: string | null | undefined, userId: string, codes: string[]): boolean {
  return codes.includes("roles.manage") || codes.includes("calendar.update") || codes.includes("calendar.delete") || organizerId === userId;
}

export function canAccessNotification(ownerId: string, userId: string, codes: string[]): boolean {
  return codes.includes("roles.manage") || ownerId === userId;
}

export function canModifyUser(targetId: string, userId: string, codes: string[]): boolean {
  return codes.includes("roles.manage") || ["users.update", "users.delete", "users.status.update"].some((code) => codes.includes(code)) || targetId === userId;
}
