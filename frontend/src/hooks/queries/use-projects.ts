"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projectsApi } from "@/lib/api/projects";
import type { ProjectCreate, ProjectUpdate } from "@/types/project";
import type { ListParams } from "@/types/common";
import { useAuthStore } from "@/store/auth-store";

const KEY = "projects";

export function useProjects(params?: ListParams, enabled = true) {
  const userId = useAuthStore((state) => state.user?.user_id);
  return useQuery({
    queryKey: [KEY, userId, params],
    queryFn: () => projectsApi.list(params),
    enabled,
  });
}

export function useProject(projectId: string | undefined) {
  const userId = useAuthStore((state) => state.user?.user_id);
  return useQuery({
    queryKey: [KEY, userId, projectId],
    queryFn: () => projectsApi.get(projectId as string),
    enabled: !!projectId,
  });
}

export function useProjectAssignmentCandidates(enabled = true) {
  const userId = useAuthStore((state) => state.user?.user_id);
  return useQuery({
    queryKey: [KEY, "assignment-candidates", userId],
    queryFn: () => projectsApi.listAssignmentCandidates(),
    enabled,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProjectCreate) => projectsApi.create(payload),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: [KEY] }),
      queryClient.invalidateQueries({ queryKey: ["teams"] }),
      queryClient.invalidateQueries({ queryKey: ["team-leads"] }),
      queryClient.invalidateQueries({ queryKey: ["workflows"] }),
      queryClient.invalidateQueries({ queryKey: ["milestones"] }),
      queryClient.invalidateQueries({ queryKey: ["kanban-columns"] }),
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
    ]),
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ProjectUpdate }) => projectsApi.update(id, payload),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: [KEY] }),
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
    ]),
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  });
}
