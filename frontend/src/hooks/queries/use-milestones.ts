"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { milestonesApi } from "@/lib/api/milestones";
import type { MilestoneCreate, MilestoneUpdate } from "@/types/milestone";

const KEY = "milestones";

export function useMilestones() {
  return useQuery({
    queryKey: [KEY],
    queryFn: () => milestonesApi.list({ limit: 500 }),
  });
}

export function useCreateMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MilestoneCreate) => milestonesApi.create(payload),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: [KEY] }),
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
    ]),
  });
}

export function useUpdateMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: MilestoneUpdate }) => milestonesApi.update(id, payload),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: [KEY] }),
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
    ]),
  });
}

export function useDeleteMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => milestonesApi.remove(id),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: [KEY] }),
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
    ]),
  });
}
