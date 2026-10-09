import type { ProjectStatus } from "@/lib/constants";

export interface ProjectBase {
  project_name: string;
  description?: string | null;
  status: ProjectStatus;
}

export interface ProjectCreate extends ProjectBase {}

export interface ProjectUpdate {
  project_name?: string;
  description?: string | null;
  status?: ProjectStatus;
}

export interface Project extends ProjectBase {
  project_id: string;
  created_at: string;
  updated_at: string;
}
