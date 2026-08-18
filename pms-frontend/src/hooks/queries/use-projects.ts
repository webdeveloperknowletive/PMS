"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projectsApi } from "@/lib/api/projects";
import type { ProjectCreate, ProjectUpdate } from "@/types/project";
import type { ListParams } from "@/types/common";

const KEY = "projects";

export function useProjects(params?: ListParams) {
  return useQuery({
    queryKey: [KEY, params],
    queryFn: () => projectsApi.list(params),
  });
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: [KEY, projectId],
    queryFn: () => projectsApi.get(projectId as string),
    enabled: !!projectId,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProjectCreate) => projectsApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ProjectUpdate }) => projectsApi.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  });
}
