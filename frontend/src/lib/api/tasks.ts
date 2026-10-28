import { apiClient } from "./client";
import { createCrudApi } from "./crud-factory";
import type { BlockedTasksSummary, BlockerOwner, SavedTaskFilter, SavedTaskFilterCreate, Sprint, SprintReport, Task, TaskActivity, TaskAttachment, TaskStatusHistory, TaskAssigneeCandidate, TaskChecklistMemberOption, TaskBulkUpdateResult, TaskComment, TaskCreate, TaskDependencyList, TaskDependencyParams, TaskLink, TaskLinkCreate, TaskUpdate, TaskWorkTime, WorkSession } from "@/types/task";

const base = createCrudApi<Task, TaskCreate, TaskUpdate>("/tasks", "task_id");

export const tasksApi = {
  ...base,

  updateCardLabels: async (taskId: string, labels: string[]): Promise<Task> => (await apiClient.patch<Task>(`/tasks/${taskId}/card-labels`, { labels })).data,
  updateCardDates: async (taskId: string, startDate: string | null, dueDate: string | null, reminderDaysBefore: Task["reminder_days_before"]): Promise<Task> => (await apiClient.patch<Task>(`/tasks/${taskId}/card-dates`, { start_date: startDate, due_date: dueDate, reminder_days_before: reminderDaysBefore })).data,
  checkDeadlineReminders: async (localDate: string): Promise<{ created_count: number }> => (await apiClient.post<{ created_count: number }>("/tasks/deadline-reminders/check", { local_date: localDate })).data,
  updateCardChecklist: async (taskId: string, checklistItems: Task["checklist_items"]): Promise<Task> => (await apiClient.patch<Task>(`/tasks/${taskId}/card-checklist`, { checklist_items: checklistItems })).data,
  getChecklistMemberOptions: async (taskId: string): Promise<TaskChecklistMemberOption[]> => (await apiClient.get<TaskChecklistMemberOption[]>(`/tasks/${taskId}/checklist-member-options`)).data,
  getCardAttachments: async (taskId: string): Promise<TaskAttachment[]> => (await apiClient.get<TaskAttachment[]>(`/tasks/${taskId}/attachments`)).data,
  uploadCardAttachment: async (taskId: string, file: File): Promise<TaskAttachment> => {
    const form = new FormData();
    form.append("file", file);
    return (await apiClient.post<TaskAttachment>(`/tasks/${taskId}/attachments`, form, { headers: { "Content-Type": "multipart/form-data" } })).data;
  },
  downloadCardAttachment: async (taskId: string, attachmentId: string): Promise<Blob> => (await apiClient.get<Blob>(`/tasks/${taskId}/attachments/${attachmentId}/download`, { responseType: "blob" })).data,
  deleteCardAttachment: async (taskId: string, attachmentId: string): Promise<void> => { await apiClient.delete(`/tasks/${taskId}/attachments/${attachmentId}`); },

  getProjectAssigneeCandidates: async (projectId: string): Promise<TaskAssigneeCandidate[]> => {
    const { data } = await apiClient.get<TaskAssigneeCandidate[]>(`/tasks/projects/${projectId}/assignee-candidates`);
    return data;
  },

  moveBacklogTask: async (taskId: string, direction: "UP" | "DOWN"): Promise<void> => {
    await apiClient.post(`/tasks/backlog/${taskId}/move`, null, { params: { direction } });
  },
  bulkUpdate: async (payload: { taskIds: string[]; priority?: Task["priority"]; dueDate?: string | null; assigneeId?: string | null }): Promise<TaskBulkUpdateResult> => {
    const { taskIds, priority, dueDate, assigneeId } = payload;
    const { data } = await apiClient.patch<TaskBulkUpdateResult>("/tasks/bulk", {
      task_ids: taskIds,
      ...(priority !== undefined ? { priority } : {}),
      ...(dueDate !== undefined ? { due_date: dueDate } : {}),
      ...(assigneeId !== undefined ? { assignee_id: assigneeId } : {}),
    });
    return data;
  },
  getBlockerSummary: async (): Promise<BlockedTasksSummary> => {
    const { data } = await apiClient.get<BlockedTasksSummary>("/tasks/blockers/summary");
    return data;
  },
  getDependencies: async (params: TaskDependencyParams): Promise<TaskDependencyList> => {
    const { data } = await apiClient.get<TaskDependencyList>("/tasks/dependencies", { params });
    return data;
  },
  getLinks: async (taskId: string): Promise<TaskLink[]> => {
    const { data } = await apiClient.get<TaskLink[]>(`/tasks/${taskId}/links`);
    return data;
  },
  getProjectLinks: async (projectId: string): Promise<TaskLink[]> => {
    const { data } = await apiClient.get<TaskLink[]>(`/tasks/projects/${projectId}/links`);
    return data;
  },
  getProjectBlockerOwners: async (projectId: string): Promise<BlockerOwner[]> => {
    const { data } = await apiClient.get<BlockerOwner[]>(`/tasks/projects/${projectId}/blocker-owners`);
    return data;
  },
  createLink: async (taskId: string, payload: TaskLinkCreate): Promise<TaskLink> => {
    const { data } = await apiClient.post<TaskLink>(`/tasks/${taskId}/links`, payload);
    return data;
  },
  updateLinkOwner: async (taskId: string, linkId: string, ownerId: string | null): Promise<TaskLink> => {
    const { data } = await apiClient.patch<TaskLink>(`/tasks/${taskId}/links/${linkId}`, { owner_id: ownerId });
    return data;
  },
  deleteLink: async (taskId: string, linkId: string): Promise<void> => {
    await apiClient.delete(`/tasks/${taskId}/links/${linkId}`);
  },

  getSavedFilters: async (): Promise<SavedTaskFilter[]> => {
    const { data } = await apiClient.get<SavedTaskFilter[]>("/tasks/saved-filters");
    return data;
  },
  createSavedFilter: async (payload: SavedTaskFilterCreate): Promise<SavedTaskFilter> => {
    const { data } = await apiClient.post<SavedTaskFilter>("/tasks/saved-filters", payload);
    return data;
  },
  deleteSavedFilter: async (filterId: string): Promise<void> => {
    await apiClient.delete(`/tasks/saved-filters/${filterId}`);
  },

  /** GET /tasks/{task_id}/subtasks */
  getSubtasks: async (taskId: string): Promise<Task[]> => {
    const { data } = await apiClient.get<Task[]>(`/tasks/${taskId}/subtasks`);
    return data;
  },
  getComments: async (taskId: string): Promise<TaskComment[]> => {
    const { data } = await apiClient.get<TaskComment[]>(`/tasks/${taskId}/comments`);
    return data;
  },
  addComment: async (taskId: string, content: string): Promise<TaskComment> => {
    const { data } = await apiClient.post<TaskComment>(`/tasks/${taskId}/comments`, { content });
    return data;
  },
  getActivity: async (taskId: string): Promise<TaskActivity[]> => {
    const { data } = await apiClient.get<TaskActivity[]>(`/tasks/${taskId}/activity`);
    return data;
  },
  getStatusHistory: async (taskId: string): Promise<TaskStatusHistory[]> => {
    const { data } = await apiClient.get<TaskStatusHistory[]>(`/tasks/${taskId}/status-history`);
    return data;
  },
  getSprints: async (projectId: string): Promise<Sprint[]> => {
    const { data } = await apiClient.get<Sprint[]>('/tasks/sprints', { params: { project_id: projectId } });
    return data;
  },
  getSprintReport: async (sprintId: string): Promise<SprintReport> => {
    const { data } = await apiClient.get<SprintReport>(`/tasks/sprints/${sprintId}/report`);
    return data;
  },
  createSprint: async (payload: Pick<Sprint, 'project_id' | 'sprint_name' | 'goal' | 'start_date' | 'end_date' | 'capacity_points'>): Promise<Sprint> => {
    const { data } = await apiClient.post<Sprint>('/tasks/sprints', payload);
    return data;
  },
  updateSprint: async (sprintId: string, payload: Partial<Pick<Sprint, 'sprint_name' | 'goal' | 'start_date' | 'end_date' | 'status' | 'capacity_points'>>): Promise<Sprint> => {
    const { data } = await apiClient.put<Sprint>(`/tasks/sprints/${sprintId}`, payload);
    return data;
  },
  getWorkSessions: async (limit = 200): Promise<WorkSession[]> => {
    const { data } = await apiClient.get<WorkSession[]>('/tasks/work-sessions', { params: { limit } });
    return data;
  },
  getTaskWorkTimes: async (): Promise<TaskWorkTime[]> => {
    const { data } = await apiClient.get<TaskWorkTime[]>('/tasks/work-time');
    return data;
  },
  startWorkSession: async (taskIds: string[]): Promise<WorkSession> => {
    const { data } = await apiClient.post<WorkSession>('/tasks/work-sessions/start', { task_ids: taskIds });
    return data;
  },
  stopWorkSession: async (): Promise<WorkSession> => {
    const { data } = await apiClient.post<WorkSession>('/tasks/work-sessions/stop');
    return data;
  },
};
