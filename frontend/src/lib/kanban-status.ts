import type { KanbanColumn, KanbanTask } from "@/types/kanban";
import type { Task } from "@/types/task";

const COLUMN_STATUS: Record<string, Task["status"]> = {
  "to do": "TODO",
  todo: "TODO",
  backlog: "TODO",
  "in progress": "IN_PROGRESS",
  "in review": "IN_REVIEW",
  "in-review": "IN_REVIEW",
  review: "IN_REVIEW",
  done: "DONE",
  complete: "DONE",
  completed: "DONE",
  blocked: "BLOCKED",
  cancelled: "CANCELLED",
};

/** The Kanban column is the current workflow state when a task has a placement. */
export function getTaskWorkflowStatus(
  task: Task,
  placements: KanbanTask[],
  columns: KanbanColumn[],
): Task["status"] {
  const placement = placements.find((item) => item.task_id === task.task_id);
  if (!placement) return task.status;

  const column = columns.find((item) => item.column_id === placement.column_id);
  if (!column) return task.status;

  return COLUMN_STATUS[column.column_name.trim().toLowerCase()] ?? task.status;
}
