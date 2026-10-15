/**
 * Mirrors app/modules/(module)/constants.py exactly.
 * These string values are sent to and received from the FastAPI backend —
 * do not change them without updating the backend enum tuples too.
 */

// ── Tasks ────────────────────────────────────────────────
export const TASK_STATUSES = [
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
  "BLOCKED",
  "CANCELLED",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];


// ── Projects ─────────────────────────────────────────────
export const PROJECT_STATUSES = [
  "ACTIVE",
  "COMPLETED",
  "ON_HOLD",
  "ARCHIVED",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];


// ── Teams ────────────────────────────────────────────────
export const TEAM_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export type TeamStatus = (typeof TEAM_STATUSES)[number];

// ── Workflow ─────────────────────────────────────────────
export const WORKFLOW_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export const WORKFLOW_TYPES = [
  "Task Workflow",
  "Approval Workflow",
  "Review Workflow",
] as const;

// ── Kanban (default board seeded per project) ───────────
export const DEFAULT_COLUMN_NAMES = ["To Do", "In Progress", "In Review", "Done"] as const;
export const DEFAULT_COLUMN_COLORS: Record<string, string> = {
  "To Do": "#94A3B8",
  "In Progress": "#3B82F6",
  "In Review": "#F59E0B",
  Done: "#22C55E",
};

/**
 * The backend has NO link between a Kanban column and a task's `status` —
 * `kanban_tasks.column_id` and `tasks.status` are independent fields. Moving
 * a card only changes column_id; it never touches status on its own.
 * This map lets the frontend *optionally* keep them in sync: when a card is
 * dropped into a column whose name matches one of these labels, we also fire
 * a task status update. Custom/renamed columns that don't match anything
 * here are left alone — status just won't update for those, by design.
 */
export const COLUMN_NAME_TO_STATUS: Record<string, TaskStatus> = {
  "To Do": "TODO",
  "In Progress": "IN_PROGRESS",
  "In Review": "IN_REVIEW",
  Done: "DONE",
};

// ── Reports ──────────────────────────────────────────────
export const REPORT_FORMATS = ["PDF", "Excel", "CSV"] as const;

// ── UI display labels/colors (frontend-only presentation layer) ──────────
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
  BLOCKED: "Blocked",
  CANCELLED: "Cancelled",
};

export const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  TODO: "bg-slate-100 text-slate-600",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  IN_REVIEW: "bg-amber-100 text-amber-700",
  DONE: "bg-green-100 text-green-700",
  BLOCKED: "bg-red-100 text-red-700",
  CANCELLED: "bg-slate-100 text-slate-400",
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const PRIORITY_COLOR: Record<TaskPriority, string> = {
  LOW: "bg-green-100 text-green-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  HIGH: "bg-red-100 text-red-700",
  URGENT: "bg-red-200 text-red-800",
};

export const PROJECT_STATUS_COLOR: Record<string, string> = {
  ACTIVE: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  ON_HOLD: "bg-amber-100 text-amber-700",
  ARCHIVED: "bg-slate-100 text-slate-500",
};

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
export const WORKSPACE_DOMAIN = process.env.NEXT_PUBLIC_WORKSPACE_DOMAIN ?? "localhost:3000";
