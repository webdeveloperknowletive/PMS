"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projectsApi } from "@/lib/api/projects";
import type { ProjectComponentCreate, ProjectCreate, ProjectCustomFieldCreate, ProjectTemplateCreate, ProjectUpdate } from "@/types/project";
import type { ProjectGoalCreate, ProjectReleaseCreate } from "@/types/task";
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

export function useProjectAssignment(projectId: string | undefined, enabled = true) {
  const userId = useAuthStore((state) => state.user?.user_id);
  return useQuery({
    queryKey: [KEY, projectId, "assignment", userId],
    queryFn: () => projectsApi.getAssignment(projectId as string),
    enabled: !!projectId && enabled,
  });
}

export function useProjectTemplates(enabled = true) {
  const userId = useAuthStore((state) => state.user?.user_id);
  return useQuery({ queryKey: [KEY, "templates", userId], queryFn: projectsApi.listTemplates, enabled });
}

export function useCreateProjectTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProjectTemplateCreate) => projectsApi.createTemplate(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY, "templates"] }),
  });
}

export function useDeleteProjectTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) => projectsApi.deleteTemplate(templateId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY, "templates"] }),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProjectCreate) => projectsApi.create(payload),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: [KEY] }),
      queryClient.invalidateQueries({ queryKey: ["teams"] }),
      queryClient.invalidateQueries({ queryKey: ["team-members"] }),
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
      queryClient.invalidateQueries({ queryKey: ["teams"] }),
      queryClient.invalidateQueries({ queryKey: ["team-members"] }),
      queryClient.invalidateQueries({ queryKey: ["team-leads"] }),
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

export function useProjectGoals(projectId: string | undefined, enabled = true) {
  return useQuery({ queryKey: [KEY, projectId, "goals"], queryFn: () => projectsApi.listGoals(projectId!), enabled: !!projectId && enabled });
}

export function useGoalPortfolio() {
  return useQuery({ queryKey: [KEY, "goal-portfolio"], queryFn: projectsApi.listGoalPortfolio });
}

export function useCreateProjectGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, payload }: { projectId: string; payload: ProjectGoalCreate }) => projectsApi.createGoal(projectId, payload),
    onSuccess: (_goal, { projectId }) => Promise.all([
      queryClient.invalidateQueries({ queryKey: [KEY, projectId, "goals"] }),
      queryClient.invalidateQueries({ queryKey: [KEY, "goal-portfolio"] }),
    ]),
  });
}

export function useUpdateProjectGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, goalId, payload }: { projectId: string; goalId: string; payload: Partial<Pick<import("@/types/task").ProjectGoal, "name" | "description" | "success_measure" | "status" | "target_date" | "owner_id" | "parent_goal_id">> }) => projectsApi.updateGoal(projectId, goalId, payload),
    onSuccess: (_goal, { projectId }) => Promise.all([
      queryClient.invalidateQueries({ queryKey: [KEY, projectId, "goals"] }),
      queryClient.invalidateQueries({ queryKey: [KEY, "goal-portfolio"] }),
    ]),
  });
}

export function useProjectReleases(projectId: string | undefined, enabled = true) {
  return useQuery({ queryKey: [KEY, projectId, "releases"], queryFn: () => projectsApi.listReleases(projectId!), enabled: !!projectId && enabled });
}

export function useProjectReleaseScopeHistory(projectId: string | undefined, releaseId: string | undefined, enabled = false) {
  return useQuery({
    queryKey: [KEY, projectId, "release-scope-history", releaseId],
    queryFn: () => projectsApi.listReleaseScopeHistory(projectId!, releaseId!),
    enabled: !!projectId && enabled,
  });
}

export function useProjectComponents(projectId: string | undefined, enabled = true) {
  return useQuery({ queryKey: [KEY, projectId, "components"], queryFn: () => projectsApi.listComponents(projectId!), enabled: !!projectId && enabled });
}

export function useCreateProjectComponent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, payload }: { projectId: string; payload: ProjectComponentCreate }) => projectsApi.createComponent(projectId, payload),
    onSuccess: (_component, { projectId }) => queryClient.invalidateQueries({ queryKey: [KEY, projectId, "components"] }),
  });
}

export function useUpdateProjectComponent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, componentId, payload }: { projectId: string; componentId: string; payload: Partial<ProjectComponentCreate> }) => projectsApi.updateComponent(projectId, componentId, payload),
    onSuccess: (_component, { projectId }) => queryClient.invalidateQueries({ queryKey: [KEY, projectId, "components"] }),
  });
}

export function useDeleteProjectComponent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, componentId }: { projectId: string; componentId: string }) => projectsApi.deleteComponent(projectId, componentId),
    onSuccess: (_result, { projectId }) => Promise.all([
      queryClient.invalidateQueries({ queryKey: [KEY, projectId, "components"] }),
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["task-activity"] }),
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
    ]),
  });
}

export function useProjectCustomFields(projectId: string | undefined) {
  return useQuery({ queryKey: [KEY, projectId, "custom-fields"], queryFn: () => projectsApi.listCustomFields(projectId!), enabled: !!projectId });
}

export function useCreateProjectCustomField() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, payload }: { projectId: string; payload: ProjectCustomFieldCreate }) => projectsApi.createCustomField(projectId, payload),
    onSuccess: (_field, { projectId }) => queryClient.invalidateQueries({ queryKey: [KEY, projectId, "custom-fields"] }),
  });
}

export function useDeleteProjectCustomField() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, fieldId }: { projectId: string; fieldId: string }) => projectsApi.deleteCustomField(projectId, fieldId),
    onSuccess: (_result, { projectId }) => Promise.all([
      queryClient.invalidateQueries({ queryKey: [KEY, projectId, "custom-fields"] }),
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
    ]),
  });
}

export function useCreateProjectRelease() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, payload }: { projectId: string; payload: ProjectReleaseCreate }) => projectsApi.createRelease(projectId, payload),
    onSuccess: (_release, { projectId }) => queryClient.invalidateQueries({ queryKey: [KEY, projectId, "releases"] }),
  });
}

export function useUpdateProjectRelease() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, releaseId, payload }: { projectId: string; releaseId: string; payload: Partial<Pick<import("@/types/task").ProjectRelease, "name" | "version" | "status" | "release_date" | "notes">> }) => projectsApi.updateRelease(projectId, releaseId, payload),
    onSuccess: (_release, { projectId }) => queryClient.invalidateQueries({ queryKey: [KEY, projectId, "releases"] }),
  });
}

export function useDeleteProjectRelease() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, releaseId }: { projectId: string; releaseId: string }) => projectsApi.deleteRelease(projectId, releaseId),
    onSuccess: (_result, { projectId }) => Promise.all([
      queryClient.invalidateQueries({ queryKey: [KEY, projectId, "releases"] }),
      queryClient.invalidateQueries({ queryKey: [KEY, projectId, "release-scope-history"] }),
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
    ]),
  });
}
