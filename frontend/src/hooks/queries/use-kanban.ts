"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { kanbanApi } from "@/lib/api/kanban";
import type { KanbanColumnCreate, KanbanColumnUpdate, KanbanLabelCreate, KanbanLabelUpdate, KanbanTaskMovePayload } from "@/types/kanban";
import type { TaskCreate } from "@/types/task";

const COLUMNS_KEY = "kanban-columns";
const PLACEMENTS_KEY = "kanban-tasks";
const LABELS_KEY = "kanban-labels";

export function useKanbanLabels(enabled = true) {
  return useQuery({
    queryKey: [LABELS_KEY],
    queryFn: () => kanbanApi.listLabels(),
    enabled,
  });
}

export function useCreateKanbanLabel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: KanbanLabelCreate) => kanbanApi.createLabel(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [LABELS_KEY] }),
  });
}

export function useUpdateKanbanLabel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ labelId, payload }: { labelId: string; payload: KanbanLabelUpdate }) => kanbanApi.updateLabel(labelId, payload),
    onSuccess: async () => Promise.all([
      queryClient.invalidateQueries({ queryKey: [LABELS_KEY] }),
      queryClient.invalidateQueries({ queryKey: [PLACEMENTS_KEY] }),
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
    ]),
  });
}

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

export function useUpdateKanbanColumn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ columnId, payload }: { columnId: string; payload: KanbanColumnUpdate }) =>
      kanbanApi.updateColumn(columnId, payload),
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
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
      queryClient.invalidateQueries({ queryKey: ["task-work-times"] }),
      queryClient.invalidateQueries({ queryKey: ["task-work-sessions"] }),
      queryClient.invalidateQueries({ queryKey: ["gantt-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
      queryClient.invalidateQueries({ queryKey: ["team-available-members"] }),
      queryClient.invalidateQueries({ queryKey: ["sprint-report"] }),
      queryClient.invalidateQueries({ queryKey: ["task-blockers-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["task-dependencies"] }),
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
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
      queryClient.invalidateQueries({ queryKey: ["task-work-times"] }),
      queryClient.invalidateQueries({ queryKey: ["task-work-sessions"] }),
      queryClient.invalidateQueries({ queryKey: ["gantt-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
      queryClient.invalidateQueries({ queryKey: ["team-available-members"] }),
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      queryClient.invalidateQueries({ queryKey: ["sprint-report"] }),
      queryClient.invalidateQueries({ queryKey: ["task-blockers-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["task-dependencies"] }),
    ]),
  });
}

export function useCancelKanbanReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, comment }: { taskId: string; comment: string }) => kanbanApi.cancelTaskReview(taskId, comment),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: [PLACEMENTS_KEY] }),
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
      queryClient.invalidateQueries({ queryKey: ["task-work-times"] }),
      queryClient.invalidateQueries({ queryKey: ["task-work-sessions"] }),
      queryClient.invalidateQueries({ queryKey: ["gantt-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      queryClient.invalidateQueries({ queryKey: ["sprint-report"] }),
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

function invalidateCardViews(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: [PLACEMENTS_KEY] }),
    queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    queryClient.invalidateQueries({ queryKey: ["projects"] }),
    queryClient.invalidateQueries({ queryKey: ["kanban-archived-cards"] }),
    queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    queryClient.invalidateQueries({ queryKey: ["gantt-tasks"] }),
    queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
  ]);
}

export function useCreateKanbanCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TaskCreate) => kanbanApi.createCard(payload),
    onSuccess: () => invalidateCardViews(queryClient),
  });
}

export function useUpdateKanbanCardDetails() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, payload }: { taskId: string; payload: { task_name: string; description: string | null } }) =>
      kanbanApi.updateCardDetails(taskId, payload),
    onSuccess: () => invalidateCardViews(queryClient),
  });
}

export function useKanbanCardMemberOptions(taskId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["kanban-card-member-options", taskId],
    queryFn: () => kanbanApi.cardMemberOptions(taskId!),
    enabled: enabled && !!taskId,
  });
}

export function useUpdateKanbanCardMembers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, memberIds }: { taskId: string; memberIds: string[] }) => kanbanApi.updateCardMembers(taskId, memberIds),
    onSuccess: async (_task, variables) => {
      await Promise.all([
        invalidateCardViews(queryClient),
        queryClient.invalidateQueries({ queryKey: ["kanban-card-member-options", variables.taskId] }),
        queryClient.invalidateQueries({ queryKey: ["tasks", variables.taskId, "activity"] }),
      ]);
    },
  });
}

export function useArchivedKanbanCards(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["kanban-archived-cards", projectId],
    queryFn: () => kanbanApi.listArchivedCards(projectId),
    enabled: enabled && !!projectId,
  });
}

export function useArchiveKanbanCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => kanbanApi.archiveCard(taskId),
    onSuccess: () => invalidateCardViews(queryClient),
  });
}

export function useRestoreKanbanCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => kanbanApi.restoreCard(taskId),
    onSuccess: () => invalidateCardViews(queryClient),
  });
}
