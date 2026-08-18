import { apiClient } from "./client";
import { createCrudApi } from "./crud-factory";
import type { Task, TaskCreate, TaskUpdate } from "@/types/task";

const base = createCrudApi<Task, TaskCreate, TaskUpdate>("/tasks", "task_id");

export const tasksApi = {
  ...base,

  /** GET /tasks/{task_id}/subtasks */
  getSubtasks: async (taskId: string): Promise<Task[]> => {
    const { data } = await apiClient.get<Task[]>(`/tasks/${taskId}/subtasks`);
    return data;
  },
};
