import type { TaskPriority, TaskStatus } from "@/lib/constants";

export interface TaskBase {
  project_id: string;
  team_id?: string | null;
  user_id?: string | null;
  sprint_plan_id?: string | null;
  sprint_id?: string | null;
  parent_task_id?: string | null;
  task_name: string;
  description?: string | null;
  task_type?: TaskType;
  story_points?: number | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string | null; // ISO date "YYYY-MM-DD"
  checklist_items?: TaskChecklistItem[];
}

export interface TaskChecklistItem {
  item_id: string;
  text: string;
  is_completed: boolean;
}

export interface TaskCreate extends TaskBase {
  kanban_column_id?: string | null;
  kanban_position?: number;
}

export interface TaskUpdate {
  user_id?: string | null;
  sprint_plan_id?: string | null;
  sprint_id?: string | null;
  parent_task_id?: string | null;
  task_name?: string;
  description?: string | null;
  task_type?: TaskType;
  story_points?: number | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
  checklist_items?: TaskChecklistItem[];
}

export interface Task extends TaskBase {
  task_id: string;
  created_at: string;
  updated_at: string;
  assignee_name?: string | null;
}

export type TaskType = "EPIC" | "STORY" | "TASK" | "BUG" | "SUBTASK";

export interface Sprint {
  sprint_id: string;
  project_id: string;
  sprint_name: string;
  goal?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status: "PLANNED" | "ACTIVE" | "COMPLETED";
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskComment {
  comment_id: string;
  task_id: string;
  author_id?: string | null;
  author_name?: string | null;
  content: string;
  created_at: string;
}

export interface TaskActivity {
  activity_id: string;
  task_id: string;
  actor_id?: string | null;
  actor_name?: string | null;
  event_type: string;
  details: string;
  created_at: string;
}

export interface WorkSession {
  work_session_id: string;
  user_id: string;
  user_name: string;
  started_at: string;
  ended_at?: string | null;
  duration_seconds: number;
  is_running: boolean;
  task_ids: string[];
  task_names: string[];
}

export interface TaskWorkTime {
  task_id: string;
  duration_seconds: number;
  is_tracking: boolean;
  active_since?: string | null;
}
