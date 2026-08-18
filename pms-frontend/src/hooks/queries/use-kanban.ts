"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { kanbanApi } from "@/lib/api/kanban";
import type { KanbanColumnCreate, KanbanTaskUpdate } from "@/types/kanban";

const COLUMNS_KEY = "kanban-columns";
const PLACEMENTS_KEY = "kanban-tasks";

export function useKanbanColumns() {
  return useQuery({
    queryKey: [COLUMNS_KEY],
    queryFn: () => kanbanApi.listColumns(),
  });
}

export function useKanbanTaskPlacements() {
  return useQuery({
    queryKey: [PLACEMENTS_KEY],
    queryFn: () => kanbanApi.listTasks(),
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
 * Uses an optimistic update so the drag feels instant, then reconciles with
 * the server response.
 */
export function useMoveKanbanTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ placementId, payload }: { placementId: string; payload: KanbanTaskUpdate }) =>
      kanbanApi.moveTask(placementId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PLACEMENTS_KEY] }),
  });
}

export function useCreateKanbanTaskPlacement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: kanbanApi.createTaskPlacement,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [PLACEMENTS_KEY] }),
  });
}
