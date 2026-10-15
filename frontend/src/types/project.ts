import type { ProjectStatus } from "@/lib/constants";

export interface ProjectBase {
  project_name: string;
  description?: string | null;
  status: ProjectStatus;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  start_date?: string | null;
  due_date?: string | null;
}

export interface ProjectCreate extends ProjectBase {
  team_lead_user_id: string;
  project_manager_user_id: string;
}

export interface ProjectUpdate {
  project_name?: string;
  description?: string | null;
  status?: ProjectStatus;
  priority?: ProjectBase["priority"];
  start_date?: string | null;
  due_date?: string | null;
}

export interface Project extends ProjectBase {
  project_id: string;
  project_manager_user_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectAssignmentCandidate {
  user_id: string;
  name: string;
  role_names: string[];
  is_active: boolean;
}
