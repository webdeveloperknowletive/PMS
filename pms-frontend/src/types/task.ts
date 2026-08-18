import type { TaskPriority, TaskStatus } from "@/lib/constants";

export interface TaskBase {
  project_id: string;
  user_id?: string | null;
  sprint_plan_id?: string | null;
  parent_task_id?: string | null;
  task_name: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string | null; // ISO date "YYYY-MM-DD"
}

export interface TaskCreate extends TaskBase {}

export interface TaskUpdate {
  user_id?: string | null;
  sprint_plan_id?: string | null;
  parent_task_id?: string | null;
  task_name?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
}

export interface Task extends TaskBase {
  task_id: string;
  created_at: string;
  updated_at: string;
}
