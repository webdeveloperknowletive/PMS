"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "@/lib/api/tasks";
import type { TaskCreate, TaskUpdate } from "@/types/task";
import type { ListParams } from "@/types/common";

const KEY = "tasks";

export function useTasks(params?: ListParams, enabled = true) {
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
      queryClient.invalidateQueries({ queryKey: ["kanban-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["gantt-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
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
      queryClient.invalidateQueries({ queryKey: ["team-available-members"] }),
    ]),
  });
}

export function useSprints(projectId: string | undefined) {
  return useQuery({ queryKey: ["task-sprints", projectId], queryFn: () => tasksApi.getSprints(projectId!), enabled: !!projectId });
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
      queryClient.invalidateQueries({ queryKey: ["kanban-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["gantt-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
      queryClient.invalidateQueries({ queryKey: ["team-available-members"] }),
    ]),
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TaskUpdate }) => tasksApi.update(id, payload),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: [KEY] }),
      queryClient.invalidateQueries({ queryKey: ["kanban-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["gantt-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
      queryClient.invalidateQueries({ queryKey: ["task-work-sessions"] }),
      queryClient.invalidateQueries({ queryKey: ["task-work-times"] }),
      queryClient.invalidateQueries({ queryKey: ["team-available-members"] }),
    ]),
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KEY] });
      queryClient.invalidateQueries({ queryKey: ["kanban-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
  });
}
