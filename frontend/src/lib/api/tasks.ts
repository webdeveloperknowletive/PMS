import { apiClient } from "./client";
import { createCrudApi } from "./crud-factory";
import type { Sprint, Task, TaskActivity, TaskComment, TaskCreate, TaskUpdate, TaskWorkTime, WorkSession } from "@/types/task";

const base = createCrudApi<Task, TaskCreate, TaskUpdate>("/tasks", "task_id");

export const tasksApi = {
  ...base,

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
  getSprints: async (projectId: string): Promise<Sprint[]> => {
    const { data } = await apiClient.get<Sprint[]>('/tasks/sprints', { params: { project_id: projectId } });
    return data;
  },
  createSprint: async (payload: Pick<Sprint, 'project_id' | 'sprint_name' | 'goal' | 'start_date' | 'end_date'>): Promise<Sprint> => {
    const { data } = await apiClient.post<Sprint>('/tasks/sprints', payload);
    return data;
  },
  updateSprint: async (sprintId: string, payload: Partial<Pick<Sprint, 'sprint_name' | 'goal' | 'start_date' | 'end_date' | 'status'>>): Promise<Sprint> => {
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
