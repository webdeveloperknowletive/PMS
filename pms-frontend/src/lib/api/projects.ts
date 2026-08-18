import { createCrudApi } from "./crud-factory";
import type { Project, ProjectCreate, ProjectUpdate } from "@/types/project";

export const projectsApi = createCrudApi<Project, ProjectCreate, ProjectUpdate>("/projects", "project_id");
