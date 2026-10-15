import { apiClient } from "./client";
import type {
  KanbanColumn,
  KanbanColumnCreate,
  KanbanColumnUpdate,
  KanbanTask,
  KanbanTaskCreate,
  KanbanTaskMovePayload,
  KanbanTaskUpdate,
} from "@/types/kanban";

export const kanbanApi = {
  // ── Columns ────────────────────────────────────────────
  listColumns: async (): Promise<KanbanColumn[]> => {
    const { data } = await apiClient.get<KanbanColumn[]>("/kanban/columns");
    return data;
  },
  getColumn: async (columnId: string): Promise<KanbanColumn> => {
    const { data } = await apiClient.get<KanbanColumn>(`/kanban/columns/${columnId}`);
    return data;
  },
  createColumn: async (payload: KanbanColumnCreate): Promise<KanbanColumn> => {
    const { data } = await apiClient.post<KanbanColumn>("/kanban/columns", payload);
    return data;
  },
  updateColumn: async (columnId: string, payload: KanbanColumnUpdate): Promise<KanbanColumn> => {
    const { data } = await apiClient.put<KanbanColumn>(`/kanban/columns/${columnId}`, payload);
    return data;
  },
  deleteColumn: async (columnId: string): Promise<void> => {
    await apiClient.delete(`/kanban/columns/${columnId}`);
  },

  // ── Task placements (which column + position a task sits at) ─────────
  listTasks: async (): Promise<KanbanTask[]> => {
    const { data } = await apiClient.get<KanbanTask[]>("/kanban/tasks");
    return data;
  },
  /**
   * NOTE on `placementId`: despite the backend's URL param being named
   * `{task_id}`, the handler does `db.get(KanbanTask, task_id)`, which looks
   * up by KanbanTask's actual primary key — `kanban_task_id` — not the
   * underlying Task's `task_id`. So every call below must be given the
   * `kanban_task_id` from a KanbanTaskRead, not `task.task_id`. Kept as-is
   * to match the backend exactly; documented here so it isn't a source of
   * silent 404s on the frontend.
   */
  getTaskPlacement: async (placementId: string): Promise<KanbanTask> => {
    const { data } = await apiClient.get<KanbanTask>(`/kanban/tasks/${placementId}`);
    return data;
  },
  createTaskPlacement: async (payload: KanbanTaskCreate): Promise<KanbanTask> => {
    const { data } = await apiClient.post<KanbanTask>("/kanban/tasks", payload);
    return data;
  },
  /**
   * Used on every drag-and-drop drop: moves a task to a new column/position.
   * Pass `kanban_task_id`. Hits the dedicated PATCH .../move endpoint, which
   * stamps `moved_by` from the authenticated user server-side — the client
   * never sends it. (Previously this called the generic PUT endpoint, which
   * meant `moved_by`/`moved_at` were never actually set on a drag.)
   */
  moveTask: async (placementId: string, payload: KanbanTaskMovePayload): Promise<KanbanTask> => {
    const { data } = await apiClient.patch<KanbanTask>(`/kanban/tasks/${placementId}/move`, payload);
    return data;
  },
  approveTaskReview: async (taskId: string): Promise<KanbanTask> => {
    const { data } = await apiClient.post<KanbanTask>(`/kanban/tasks/${taskId}/approve-review`);
    return data;
  },
  deleteTaskPlacement: async (placementId: string): Promise<void> => {
    await apiClient.delete(`/kanban/tasks/${placementId}`);
  },
};
