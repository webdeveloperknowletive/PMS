"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { kanbanApi } from "@/lib/api/kanban";
import type { KanbanColumnCreate, KanbanTaskMovePayload } from "@/types/kanban";

const COLUMNS_KEY = "kanban-columns";
const PLACEMENTS_KEY = "kanban-tasks";

export function useKanbanColumns(enabled = true) {
  return useQuery({
    queryKey: [COLUMNS_KEY],
    queryFn: () => kanbanApi.listColumns(),
    enabled,
  });
}

export function useKanbanTaskPlacements(enabled = true) {
  return useQuery({
    queryKey: [PLACEMENTS_KEY],
    queryFn: () => kanbanApi.listTasks(),
    enabled,
    refetchInterval: 2_000,
    refetchOnWindowFocus: true,
  });
}

export function useCreateKanbanColumn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: KanbanColumnCreate) => kanbanApi.createColumn(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [COLUMNS_KEY] }),
  });
}

export function useDeleteKanbanColumn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (columnId: string) => kanbanApi.deleteColumn(columnId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COLUMNS_KEY] });
      queryClient.invalidateQueries({ queryKey: [PLACEMENTS_KEY] });
    },
  });
}

/**
 * Moves a task's placement to a new column/position. `placementId` MUST be
 * the placement's own `kanban_task_id`, not the underlying task's `task_id`
 * (see the note in lib/api/kanban.ts on the backend's param-naming quirk).
 * Hits the dedicated /move endpoint — `moved_by` is stamped server-side
 * from the authenticated user, so it's not part of this payload.
 */
export function useMoveKanbanTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ placementId, payload }: { placementId: string; payload: KanbanTaskMovePayload }) =>
      kanbanApi.moveTask(placementId, payload),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: [PLACEMENTS_KEY] }),
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["task-work-times"] }),
      queryClient.invalidateQueries({ queryKey: ["task-work-sessions"] }),
      queryClient.invalidateQueries({ queryKey: ["gantt-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
      queryClient.invalidateQueries({ queryKey: ["team-available-members"] }),
    ]),
  });
}

export function useApproveKanbanReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => kanbanApi.approveTaskReview(taskId),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: [PLACEMENTS_KEY] }),
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["task-work-times"] }),
      queryClient.invalidateQueries({ queryKey: ["task-work-sessions"] }),
      queryClient.invalidateQueries({ queryKey: ["gantt-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
      queryClient.invalidateQueries({ queryKey: ["team-available-members"] }),
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    ]),
  });
}

export function useCreateKanbanTaskPlacement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: kanbanApi.createTaskPlacement,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PLACEMENTS_KEY] }),
  });
}
