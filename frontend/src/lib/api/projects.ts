import { createCrudApi } from "./crud-factory";
import { apiClient } from "./client";
import type { Project, ProjectAssignmentCandidate, ProjectCreate, ProjectUpdate } from "@/types/project";

const crudApi = createCrudApi<Project, ProjectCreate, ProjectUpdate>("/projects", "project_id");

export const projectsApi = {
  ...crudApi,
  async listAssignmentCandidates(): Promise<ProjectAssignmentCandidate[]> {
    const { data } = await apiClient.get<ProjectAssignmentCandidate[]>("/projects/assignment-candidates");
    return data;
  },
};
