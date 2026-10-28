import { apiClient } from "./client";
import type {
  KanbanColumn,
  KanbanColumnCreate,
  KanbanColumnUpdate,
  KanbanCardMemberOption,
  KanbanLabel,
  KanbanLabelCreate,
  KanbanLabelUpdate,
  KanbanTask,
  KanbanTaskCreate,
  KanbanTaskMovePayload,
  KanbanTaskUpdate,
} from "@/types/kanban";
import type { Task, TaskCreate } from "@/types/task";

export const kanbanApi = {
  listLabels: async (): Promise<KanbanLabel[]> => {
    const { data } = await apiClient.get<KanbanLabel[]>("/kanban/labels");
    return data;
  },
  createLabel: async (payload: KanbanLabelCreate): Promise<KanbanLabel> => {
    const { data } = await apiClient.post<KanbanLabel>("/kanban/labels", payload);
    return data;
  },
  updateLabel: async (labelId: string, payload: KanbanLabelUpdate): Promise<KanbanLabel> => {
    const { data } = await apiClient.patch<KanbanLabel>(`/kanban/labels/${labelId}`, payload);
    return data;
  },
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
  cancelTaskReview: async (taskId: string, comment: string): Promise<KanbanTask> => {
    const { data } = await apiClient.post<KanbanTask>(`/kanban/tasks/${taskId}/cancel-review`, { content: comment });
    return data;
  },
  createCard: async (payload: TaskCreate): Promise<Task> => {
    const { data } = await apiClient.post<Task>("/kanban/cards", payload);
    return data;
  },
  updateCardDetails: async (taskId: string, payload: { task_name: string; description: string | null }): Promise<Task> => {
    const { data } = await apiClient.patch<Task>(`/kanban/cards/${taskId}`, payload);
    return data;
  },
  listArchivedCards: async (projectId: string): Promise<Task[]> => {
    const { data } = await apiClient.get<Task[]>("/kanban/cards/archived", { params: { project_id: projectId } });
    return data;
  },
  archiveCard: async (taskId: string): Promise<Task> => {
    const { data } = await apiClient.post<Task>(`/kanban/cards/${taskId}/archive`);
    return data;
  },
  restoreCard: async (taskId: string): Promise<Task> => {
    const { data } = await apiClient.post<Task>(`/kanban/cards/${taskId}/restore`);
    return data;
  },
  cardMemberOptions: async (taskId: string): Promise<KanbanCardMemberOption[]> => {
    const { data } = await apiClient.get<KanbanCardMemberOption[]>(`/kanban/cards/${taskId}/member-options`);
    return data;
  },
  updateCardMembers: async (taskId: string, memberIds: string[]): Promise<Task> => {
    const { data } = await apiClient.put<Task>(`/kanban/cards/${taskId}/members`, { member_ids: memberIds });
    return data;
  },
  deleteTaskPlacement: async (placementId: string): Promise<void> => {
    await apiClient.delete(`/kanban/tasks/${placementId}`);
  },
};
