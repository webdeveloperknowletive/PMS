"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ganttApi } from "@/lib/api/gantt";
import type { GanttTaskCreate, GanttTaskUpdate } from "@/types/gantt";

const KEY = "gantt-tasks";

export function useGanttTasks() {
  return useQuery({
    queryKey: [KEY],
    queryFn: () => ganttApi.list({ limit: 500 }),
  });
}

export function useCreateGanttTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: GanttTaskCreate) => ganttApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateGanttTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: GanttTaskUpdate }) => ganttApi.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteGanttTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ganttApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  });
}
