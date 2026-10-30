import type { TaskPriority, TaskStatus } from "@/lib/constants";

export interface TaskBase {
  project_id: string;
  goal_id?: string | null;
  release_id?: string | null;
  component_id?: string | null;
  labels?: string[];
  custom_fields?: Record<string, unknown>;
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
  start_date?: string | null;
  due_date?: string | null; // ISO date "YYYY-MM-DD"
  /** In-app reminder lead time in calendar days; 0 means on the due date. */
  reminder_days_before?: 0 | 1 | 2 | 7 | null;
  checklist_items?: TaskChecklistItem[];
}

export interface TaskChecklistItem {
  item_id: string;
  text: string;
  is_completed: boolean;
  assignee_user_id?: string | null;
  /** Server-provided display name for the assigned project team member. */
  assignee_name?: string | null;
  due_date?: string | null;
}

export interface TaskChecklistMemberOption {
  user_id: string;
  name: string;
}

export interface TaskAttachment {
  attachment_id: string;
  task_id: string;
  uploaded_by: string | null;
  uploader_name?: string | null;
  original_filename: string;
  mime_type: string;
  file_size: number;
  created_at: string;
}

export interface TaskCardMember {
  user_id: string;
  name: string;
  profile_picture_url?: string | null;
  is_primary: boolean;
  assigned_at?: string | null;
}

export interface TaskAssigneeCandidate {
  user_id: string;
  name: string;
  role_name: string;
  team_id: string | null;
  team_name: string | null;
}

export interface TaskCreate extends TaskBase {
  kanban_column_id?: string | null;
  kanban_position?: number;
}

export interface TaskUpdate {
  goal_id?: string | null;
  release_id?: string | null;
  component_id?: string | null;
  labels?: string[];
  custom_fields?: Record<string, unknown> | null;
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
  start_date?: string | null;
  due_date?: string | null;
  reminder_days_before?: 0 | 1 | 2 | 7 | null;
  checklist_items?: TaskChecklistItem[];
}

export interface Task extends TaskBase {
  task_id: string;
  backlog_rank: number;
  created_at: string;
  updated_at: string;
  assignee_name?: string | null;
  review_feedback?: string | null;
  archived_at?: string | null;
  archived_by_user_id?: string | null;
  card_members?: TaskCardMember[];
}

export type TaskType = "EPIC" | "STORY" | "TASK" | "BUG" | "SPIKE" | "SUBTASK";

export interface ProjectGoal {
  goal_id: string;
  project_id: string;
  name: string;
  description?: string | null;
  success_measure?: string | null;
  owner_id?: string | null;
  owner_name?: string | null;
  parent_goal_id?: string | null;
  status: "ACTIVE" | "AT_RISK" | "COMPLETED" | "CANCELLED";
  target_date?: string | null;
  task_count: number;
  completed_task_count: number;
  progress_percent: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectGoalPortfolio extends ProjectGoal {
  project_name: string;
}

export type ProjectGoalCreate = Pick<ProjectGoal, "name" | "description" | "success_measure" | "owner_id" | "parent_goal_id" | "target_date">;

export interface ProjectRelease {
  release_id: string;
  project_id: string;
  name: string;
  version?: string | null;
  status: "PLANNED" | "IN_PROGRESS" | "RELEASED" | "CANCELLED";
  release_date?: string | null;
  notes?: string | null;
  task_count: number;
  completed_task_count: number;
  unresolved_task_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectReleaseScopeChange {
  scope_change_id: string;
  project_id: string;
  release_id: string;
  release_name: string;
  task_id?: string | null;
  task_name: string;
  actor_id?: string | null;
  actor_name?: string | null;
  event_type: "BASELINE" | "ADDED" | "REMOVED";
  created_at: string;
}

export type ProjectReleaseCreate = Pick<ProjectRelease, "name" | "version" | "release_date" | "notes">;

export interface Sprint {
  sprint_id: string;
  project_id: string;
  sprint_name: string;
  goal?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  capacity_points?: number | null;
  status: "PLANNED" | "ACTIVE" | "COMPLETED";
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SprintReport {
  sprint_id: string;
  total_tasks: number;
  completed_tasks: number;
  remaining_tasks: number;
  overdue_tasks: number;
  current_scope_points: number;
  completed_points: number;
  remaining_points: number;
  capacity_points: number | null;
  original_scope_points: number | null;
  scope_added_points: number;
  scope_removed_points: number;
  scope_changes: SprintScopeChange[];
  status_counts: Record<string, number>;
  started_at: string | null;
  completed_at: string | null;
  history_start_date: string | null;
  burndown_history_available: boolean;
  burndown: SprintBurndownPoint[];
  velocity_points: number | null;
  velocity_basis: "PROJECT" | "MY_ASSIGNED_TASKS";
  velocity_history: SprintVelocity[];
  average_velocity_points: number | null;
  total_throughput_tasks: number;
  average_cycle_time_days: number | null;
  median_cycle_time_days: number | null;
  cycle_time_sample_count: number;
}

export interface SprintBurndownPoint {
  date: string;
  remaining_points: number;
  ideal_points: number;
  completed_points: number;
  remaining_tasks: number;
  throughput_completed_tasks: number;
  status_counts: Record<string, number>;
}

export interface SprintVelocity {
  sprint_id: string;
  sprint_name: string;
  completed_at: string;
  delivered_points: number;
}

export interface SprintScopeChange {
  scope_change_id: string;
  task_id: string | null;
  task_name: string;
  actor_id: string | null;
  event_type: "BASELINE" | "ADDED" | "REMOVED" | "POINTS_CHANGED";
  points_before: number | null;
  points_after: number | null;
  created_at: string;
}

export interface TaskComment {
  comment_id: string;
  task_id: string;
  author_id?: string | null;
  author_name?: string | null;
  author_profile_picture_url?: string | null;
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

export interface TaskStatusHistory {
  history_id: string;
  task_id: string;
  task_name: string;
  actor_id: string | null;
  from_status: TaskStatus | null;
  to_status: TaskStatus;
  created_at: string;
}

export type TaskLinkType = "BLOCKS" | "RELATES_TO" | "DUPLICATES";

export interface BlockerOwner {
  user_id: string;
  name: string;
}

export interface BlockedTask {
  link_id: string;
  project_id: string;
  project_name: string;
  source_task_id: string;
  source_task_name: string;
  target_task_id: string;
  target_task_name: string;
  target_due_date: string | null;
  owner_id: string | null;
  owner_name: string | null;
}

export interface BlockedTasksSummary {
  count: number;
  items: BlockedTask[];
}

export interface TaskDependencyList {
  total_count: number;
  items: BlockedTask[];
}

export interface TaskDependencyParams {
  skip?: number;
  limit?: number;
  project_id?: string;
  owner_id?: string;
  unassigned?: boolean;
  overdue?: boolean;
  search?: string;
}

export interface TaskBulkUpdateResult {
  updated_count: number;
}

export interface TaskLink {
  link_id: string;
  source_task_id: string;
  target_task_id: string;
  owner_id?: string | null;
  owner_name?: string | null;
  source_task_name: string;
  target_task_name: string;
  link_type: TaskLinkType;
  created_by?: string | null;
  created_at: string;
}

export interface TaskLinkCreate {
  target_task_id: string;
  link_type: TaskLinkType;
  owner_id?: string | null;
}

export interface SavedTaskFilter {
  filter_id: string;
  user_id: string;
  name: string;
  search: string | null;
  project_id: string | null;
  assignee_id: string | null;
  component_id: string | null;
  release_id: string | null;
  label: string | null;
  status: TaskStatus | null;
  priority: TaskPriority | null;
  overdue: boolean;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

export type SavedTaskFilterCreate = Pick<SavedTaskFilter, "name" | "search" | "project_id" | "assignee_id" | "component_id" | "release_id" | "label" | "status" | "priority" | "overdue" | "is_shared">;

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
  reported_duration_seconds?: number;
  pending_review_seconds?: number;
  is_tracking: boolean;
  is_reported_tracking?: boolean;
  active_since?: string | null;
}
