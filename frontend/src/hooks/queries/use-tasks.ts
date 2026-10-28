"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "@/lib/api/tasks";
import type { SavedTaskFilterCreate, TaskCreate, TaskDependencyParams, TaskLinkCreate, TaskUpdate } from "@/types/task";
import type { TaskListParams } from "@/types/common";

const KEY = "tasks";

export function useTasks(params?: TaskListParams, enabled = true) {
  return useQuery({
    queryKey: [KEY, params],
    queryFn: () => tasksApi.list(params),
    enabled,
    refetchInterval: 2_000,
    refetchOnWindowFocus: true,
  });
}

export function useTask(taskId: string | undefined) {
  return useQuery({
    queryKey: [KEY, taskId],
    queryFn: () => tasksApi.get(taskId as string),
    enabled: !!taskId,
  });
}

export function useProjectAssigneeCandidates(projectId: string | undefined) {
  return useQuery({
    queryKey: [KEY, projectId, "assignee-candidates"],
    queryFn: () => tasksApi.getProjectAssigneeCandidates(projectId!),
    enabled: !!projectId,
  });
}

export function useSavedTaskFilters() {
  return useQuery({ queryKey: [KEY, "saved-filters"], queryFn: tasksApi.getSavedFilters });
}

export function useCreateSavedTaskFilter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SavedTaskFilterCreate) => tasksApi.createSavedFilter(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY, "saved-filters"] }),
  });
}

export function useDeleteSavedTaskFilter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (filterId: string) => tasksApi.deleteSavedFilter(filterId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY, "saved-filters"] }),
  });
}

export function useSubtasks(taskId: string | undefined) {
  return useQuery({
    queryKey: [KEY, taskId, "subtasks"],
    queryFn: () => tasksApi.getSubtasks(taskId as string),
    enabled: !!taskId,
  });
}

export function useTaskComments(taskId: string | undefined) {
  return useQuery({ queryKey: [KEY, taskId, "comments"], queryFn: () => tasksApi.getComments(taskId!), enabled: !!taskId });
}

export function useTaskActivity(taskId: string | undefined) {
  return useQuery({ queryKey: [KEY, taskId, "activity"], queryFn: () => tasksApi.getActivity(taskId!), enabled: !!taskId });
}

export function useTaskStatusHistory(taskId: string | undefined) {
  return useQuery({ queryKey: [KEY, taskId, "status-history"], queryFn: () => tasksApi.getStatusHistory(taskId!), enabled: !!taskId });
}

export function useTaskLinks(taskId: string | undefined, enabled = true) {
  return useQuery({ queryKey: [KEY, taskId, "links"], queryFn: () => tasksApi.getLinks(taskId!), enabled: !!taskId && enabled });
}

export function useBlockedTasksSummary(enabled = true) {
  return useQuery({
    queryKey: ["task-blockers-summary"],
    queryFn: tasksApi.getBlockerSummary,
    enabled,
    refetchInterval: enabled ? 5_000 : false,
  });
}

export function useTaskDependencies(params: TaskDependencyParams, enabled = true) {
  return useQuery({
    queryKey: ["task-dependencies", params],
    queryFn: () => tasksApi.getDependencies(params),
    enabled,
    refetchInterval: 10_000,
  });
}

export function useProjectBlockerOwners(projectId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["project-blocker-owners", projectId],
    queryFn: () => tasksApi.getProjectBlockerOwners(projectId!),
    enabled: !!projectId && enabled,
  });
}

export function useCreateTaskLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, payload }: { taskId: string; payload: TaskLinkCreate }) => tasksApi.createLink(taskId, payload),
    onSuccess: (_link, { taskId, payload }) => Promise.all([
      queryClient.invalidateQueries({ queryKey: [KEY] }),
      queryClient.invalidateQueries({ queryKey: [KEY, taskId, "activity"] }),
      queryClient.invalidateQueries({ queryKey: [KEY, payload.target_task_id, "activity"] }),
      queryClient.invalidateQueries({ queryKey: ["project-task-links"] }),
      queryClient.invalidateQueries({ queryKey: ["task-blockers-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["task-dependencies"] }),
    ]),
  });
}

export function useDeleteTaskLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, linkId }: { taskId: string; linkId: string }) => tasksApi.deleteLink(taskId, linkId),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: [KEY] }),
      queryClient.invalidateQueries({ queryKey: ["project-task-links"] }),
      queryClient.invalidateQueries({ queryKey: ["task-blockers-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["task-dependencies"] }),
    ]),
  });
}

export function useUpdateTaskLinkOwner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, linkId, ownerId }: { taskId: string; linkId: string; ownerId: string | null }) => tasksApi.updateLinkOwner(taskId, linkId, ownerId),
    onSuccess: (_link, { taskId }) => Promise.all([
      queryClient.invalidateQueries({ queryKey: [KEY, taskId, "links"] }),
      queryClient.invalidateQueries({ queryKey: [KEY, taskId, "activity"] }),
      queryClient.invalidateQueries({ queryKey: ["project-task-links"] }),
      queryClient.invalidateQueries({ queryKey: ["task-blockers-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["task-dependencies"] }),
    ]),
  });
}

export function useWorkSessions(enabled = true) {
  return useQuery({
    queryKey: ["task-work-sessions"],
    queryFn: () => tasksApi.getWorkSessions(),
    enabled,
    refetchInterval: 5_000,
  });
}

export function useTaskWorkTimes(enabled = true) {
  return useQuery({
    queryKey: ["task-work-times"],
    queryFn: tasksApi.getTaskWorkTimes,
    enabled,
    refetchInterval: 5_000,
  });
}

export function useStartWorkSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskIds: string[]) => tasksApi.startWorkSession(taskIds),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ["task-work-sessions"] }),
      queryClient.invalidateQueries({ queryKey: ["task-work-times"] }),
      queryClient.invalidateQueries({ queryKey: [KEY] }),
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
      queryClient.invalidateQueries({ queryKey: ["kanban-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["gantt-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
      queryClient.invalidateQueries({ queryKey: ["sprint-report"] }),
    ]),
  });
}

export function useStopWorkSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: tasksApi.stopWorkSession,
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ["task-work-sessions"] }),
      queryClient.invalidateQueries({ queryKey: ["task-work-times"] }),
      queryClient.invalidateQueries({ queryKey: [KEY] }),
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
      queryClient.invalidateQueries({ queryKey: ["sprint-report"] }),
      queryClient.invalidateQueries({ queryKey: ["team-available-members"] }),
    ]),
  });
}

export function useSprints(projectId: string | undefined) {
  return useQuery({ queryKey: ["task-sprints", projectId], queryFn: () => tasksApi.getSprints(projectId!), enabled: !!projectId });
}

export function useSprintReport(sprintId: string | undefined) {
  return useQuery({
    queryKey: ["sprint-report", sprintId],
    queryFn: () => tasksApi.getSprintReport(sprintId!),
    enabled: !!sprintId,
  });
}

export function useCreateSprint() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: tasksApi.createSprint, onSuccess: () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["task-sprints"] }),
    queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
  ]) });
}

export function useUpdateSprint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof tasksApi.updateSprint>[1] }) => tasksApi.updateSprint(id, payload),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ["task-sprints"] }),
      queryClient.invalidateQueries({ queryKey: ["sprint-report"] }),
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
    ]),
  });
}

export function useAddTaskComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, content }: { taskId: string; content: string }) => tasksApi.addComment(taskId, content),
    onSuccess: (_comment, variables) => {
      queryClient.invalidateQueries({ queryKey: [KEY, variables.taskId, "comments"] });
      queryClient.invalidateQueries({ queryKey: [KEY, variables.taskId, "activity"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TaskCreate) => tasksApi.create(payload),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: [KEY] }),
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
      queryClient.invalidateQueries({ queryKey: ["kanban-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["gantt-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
      queryClient.invalidateQueries({ queryKey: ["team-available-members"] }),
      queryClient.invalidateQueries({ queryKey: ["sprint-report"] }),
      queryClient.invalidateQueries({ queryKey: ["task-blockers-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["task-dependencies"] }),
    ]),
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TaskUpdate }) => tasksApi.update(id, payload),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: [KEY] }),
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
      queryClient.invalidateQueries({ queryKey: ["kanban-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["gantt-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
      queryClient.invalidateQueries({ queryKey: ["task-work-sessions"] }),
      queryClient.invalidateQueries({ queryKey: ["task-work-times"] }),
      queryClient.invalidateQueries({ queryKey: ["team-available-members"] }),
      queryClient.invalidateQueries({ queryKey: ["sprint-report"] }),
      queryClient.invalidateQueries({ queryKey: ["task-blockers-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["task-dependencies"] }),
    ]),
  });
}

export function useUpdateCardChecklist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, items }: { taskId: string; items: TaskUpdate["checklist_items"] }) => tasksApi.updateCardChecklist(taskId, items),
    onSuccess: (_task, { taskId }) => Promise.all([
      queryClient.invalidateQueries({ queryKey: [KEY] }),
      queryClient.invalidateQueries({ queryKey: [KEY, taskId, "activity"] }),
      queryClient.invalidateQueries({ queryKey: ["kanban-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
    ]),
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["kanban-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["sprint-report"] });
      queryClient.invalidateQueries({ queryKey: ["task-blockers-summary"] });
      queryClient.invalidateQueries({ queryKey: ["task-dependencies"] });
    },
  });
}

export function useMoveBacklogTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, direction }: { taskId: string; direction: "UP" | "DOWN" }) => tasksApi.moveBacklogTask(taskId, direction),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: [KEY] }),
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
    ]),
  });
}

export function useBulkUpdateTasks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { taskIds: string[]; priority?: TaskCreate["priority"]; dueDate?: string | null; assigneeId?: string | null }) => tasksApi.bulkUpdate(payload),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: [KEY] }),
      queryClient.invalidateQueries({ queryKey: ["kanban-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
      queryClient.invalidateQueries({ queryKey: ["gantt-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["task-work-times"] }),
      queryClient.invalidateQueries({ queryKey: ["team-available-members"] }),
      queryClient.invalidateQueries({ queryKey: ["task-blockers-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["task-dependencies"] }),
      queryClient.invalidateQueries({ queryKey: ["sprint-report"] }),
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
    ]),
  });
}
