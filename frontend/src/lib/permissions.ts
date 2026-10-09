/** UI capability helpers based on permission codes returned by the API. */
export interface Capabilities {
  isAdmin: boolean;
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
  return {
    isAdmin: has("roles.manage"),
    canManageProjects: has("projects.manage"),
    canManageTeams: has("teams.manage"),
    canManageTasks: has("tasks.manage"),
    canManageMilestones: has("milestones.manage"),
    canManageWorkflow: has("workflow.manage"),
    canManageKanbanBoard: has("kanban.manage"),
    canMoveKanbanCard: has("kanban.move"),
    canManageGantt: has("gantt.manage"),
    canUploadDocuments: has("documents.upload"),
    canDeleteDocuments: has("documents.delete"),
    canCreateEvent: has("calendar.create"),
    canManageReports: has("reports.manage"),
    canManageRoles: has("roles.manage"),
    canManageUsers: has("users.manage"),
    canUseAI: has("ai.use"),
  };
}

export function canUpdateTask(assigneeId: string | null | undefined, userId: string, codes: string[]): boolean {
  return codes.includes("tasks.manage") || (codes.includes("tasks.update_assigned") && assigneeId === userId);
}

export function canManageTeamMembership(_leadId: string, _userId: string, codes: string[]): boolean {
  return codes.includes("teams.manage") || codes.includes("teams.members.manage");
}

export function canModifyEvent(organizerId: string | null | undefined, userId: string, codes: string[]): boolean {
  return codes.includes("calendar.manage") || organizerId === userId;
}

export function canAccessNotification(ownerId: string, userId: string, codes: string[]): boolean {
  return codes.includes("roles.manage") || ownerId === userId;
}

export function canModifyUser(targetId: string, userId: string, codes: string[]): boolean {
  return codes.includes("users.manage") || targetId === userId;
}
