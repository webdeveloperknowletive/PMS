"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { workflowApi } from "@/lib/api/workflow";
import type { WorkflowCreate, WorkflowUpdate } from "@/types/workflow";

const KEY = "workflows";

export function useWorkflows() {
  return useQuery({
    queryKey: [KEY],
    queryFn: () => workflowApi.list({ limit: 500 }),
  });
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: WorkflowCreate) => workflowApi.create(payload),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: [KEY] }),
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
    ]),
  });
}

export function useUpdateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: WorkflowUpdate }) => workflowApi.update(id, payload),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: [KEY] }),
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
    ]),
  });
}

export function useDeleteWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => workflowApi.remove(id),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: [KEY] }),
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
    ]),
  });
}
