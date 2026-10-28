import { createCrudApi } from "./crud-factory";
import { apiClient } from "./client";
import type { Project, ProjectAssignment, ProjectAssignmentCandidate, ProjectComponent, ProjectComponentCreate, ProjectCreate, ProjectCustomField, ProjectCustomFieldCreate, ProjectTemplate, ProjectTemplateCreate, ProjectUpdate } from "@/types/project";
import type { ProjectGoal, ProjectGoalCreate, ProjectGoalPortfolio, ProjectRelease, ProjectReleaseCreate, ProjectReleaseScopeChange } from "@/types/task";

const crudApi = createCrudApi<Project, ProjectCreate, ProjectUpdate>("/projects", "project_id");

export const projectsApi = {
  ...crudApi,
  async listTemplates(): Promise<ProjectTemplate[]> {
    const { data } = await apiClient.get<ProjectTemplate[]>("/projects/templates");
    return data;
  },
  async createTemplate(payload: ProjectTemplateCreate): Promise<ProjectTemplate> {
    const { data } = await apiClient.post<ProjectTemplate>("/projects/templates", payload);
    return data;
  },
  async deleteTemplate(templateId: string): Promise<void> {
    await apiClient.delete(`/projects/templates/${templateId}`);
  },
  async listAssignmentCandidates(): Promise<ProjectAssignmentCandidate[]> {
    const { data } = await apiClient.get<ProjectAssignmentCandidate[]>("/projects/assignment-candidates");
    return data;
  },
  async getAssignment(projectId: string): Promise<ProjectAssignment> {
    const { data } = await apiClient.get<ProjectAssignment>(`/projects/${projectId}/assignment`);
    return data;
  },
  async listComponents(projectId: string): Promise<ProjectComponent[]> {
    const { data } = await apiClient.get<ProjectComponent[]>(`/projects/${projectId}/components`);
    return data;
  },
  async createComponent(projectId: string, payload: ProjectComponentCreate): Promise<ProjectComponent> {
    const { data } = await apiClient.post<ProjectComponent>(`/projects/${projectId}/components`, payload);
    return data;
  },
  async updateComponent(projectId: string, componentId: string, payload: Partial<ProjectComponentCreate>): Promise<ProjectComponent> {
    const { data } = await apiClient.put<ProjectComponent>(`/projects/${projectId}/components/${componentId}`, payload);
    return data;
  },
  async deleteComponent(projectId: string, componentId: string): Promise<void> {
    await apiClient.delete(`/projects/${projectId}/components/${componentId}`);
  },
  async listCustomFields(projectId: string): Promise<ProjectCustomField[]> {
    const { data } = await apiClient.get<ProjectCustomField[]>(`/projects/${projectId}/custom-fields`);
    return data;
  },
  async createCustomField(projectId: string, payload: ProjectCustomFieldCreate): Promise<ProjectCustomField> {
    const { data } = await apiClient.post<ProjectCustomField>(`/projects/${projectId}/custom-fields`, payload);
    return data;
  },
  async deleteCustomField(projectId: string, fieldId: string): Promise<void> {
    await apiClient.delete(`/projects/${projectId}/custom-fields/${fieldId}`);
  },
  async listGoals(projectId: string): Promise<ProjectGoal[]> {
    const { data } = await apiClient.get<ProjectGoal[]>(`/projects/${projectId}/goals`);
    return data;
  },
  async listGoalPortfolio(): Promise<ProjectGoalPortfolio[]> {
    const { data } = await apiClient.get<ProjectGoalPortfolio[]>("/projects/goals/portfolio");
    return data;
  },
  async createGoal(projectId: string, payload: ProjectGoalCreate): Promise<ProjectGoal> {
    const { data } = await apiClient.post<ProjectGoal>(`/projects/${projectId}/goals`, payload);
    return data;
  },
  async updateGoal(projectId: string, goalId: string, payload: Partial<Pick<ProjectGoal, "name" | "description" | "success_measure" | "status" | "target_date" | "owner_id" | "parent_goal_id">>): Promise<ProjectGoal> {
    const { data } = await apiClient.put<ProjectGoal>(`/projects/${projectId}/goals/${goalId}`, payload);
    return data;
  },
  async listReleases(projectId: string): Promise<ProjectRelease[]> {
    const { data } = await apiClient.get<ProjectRelease[]>(`/projects/${projectId}/releases`);
    return data;
  },
  async listReleaseScopeHistory(projectId: string, releaseId?: string, limit = 100): Promise<ProjectReleaseScopeChange[]> {
    const { data } = await apiClient.get<ProjectReleaseScopeChange[]>(`/projects/${projectId}/release-scope-history`, {
      params: { ...(releaseId ? { release_id: releaseId } : {}), limit },
    });
    return data;
  },
  async createRelease(projectId: string, payload: ProjectReleaseCreate): Promise<ProjectRelease> {
    const { data } = await apiClient.post<ProjectRelease>(`/projects/${projectId}/releases`, payload);
    return data;
  },
  async updateRelease(projectId: string, releaseId: string, payload: Partial<Pick<ProjectRelease, "name" | "version" | "status" | "release_date" | "notes">>): Promise<ProjectRelease> {
    const { data } = await apiClient.put<ProjectRelease>(`/projects/${projectId}/releases/${releaseId}`, payload);
    return data;
  },
  async deleteRelease(projectId: string, releaseId: string): Promise<void> {
    await apiClient.delete(`/projects/${projectId}/releases/${releaseId}`);
  },
};
