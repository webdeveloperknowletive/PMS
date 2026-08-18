"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "@/lib/api/tasks";
import type { TaskCreate, TaskUpdate } from "@/types/task";
import type { ListParams } from "@/types/common";

const KEY = "tasks";

export function useTasks(params?: ListParams) {
  return useQuery({
    queryKey: [KEY, params],
    queryFn: () => tasksApi.list(params),
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

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TaskCreate) => tasksApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TaskUpdate }) => tasksApi.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  });
}
