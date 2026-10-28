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
  board_template?: "STANDARD" | "SIMPLE" | "BLOCKED";
  project_template_id?: string | null;
  team_lead_user_id: string;
  project_manager_user_id?: string | null;
  team_member_user_ids?: string[];
}

export interface ProjectTemplate {
  template_id: string;
  name: string;
  board_template: "STANDARD" | "SIMPLE" | "BLOCKED";
  created_at: string;
  updated_at: string;
}

export type ProjectTemplateCreate = Pick<ProjectTemplate, "name" | "board_template">;

export interface ProjectUpdate {
  project_name?: string;
  description?: string | null;
  status?: ProjectStatus;
  priority?: ProjectBase["priority"];
  start_date?: string | null;
  due_date?: string | null;
  team_lead_user_id?: string;
  team_member_user_ids?: string[];
}

export interface ProjectAssignment {
  team_id: string | null;
  team_lead_user_id: string | null;
  team_member_user_ids: string[];
}

export interface Project extends ProjectBase {
  project_id: string;
  project_key: string;
  project_manager_user_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectComponent {
  component_id: string;
  project_id: string;
  name: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export type ProjectComponentCreate = Pick<ProjectComponent, "name" | "description">;

export type ProjectCustomFieldType = "TEXT" | "NUMBER" | "DATE" | "SINGLE_SELECT" | "CHECKBOX";

export interface ProjectCustomField {
  field_id: string;
  project_id: string;
  name: string;
  field_type: ProjectCustomFieldType;
  is_required: boolean;
  options: string[];
  default_value: unknown;
}

export type ProjectCustomFieldCreate = Pick<ProjectCustomField, "name" | "field_type" | "is_required" | "options" | "default_value">;

export interface ProjectAssignmentCandidate {
  user_id: string;
  name: string;
  role_names: string[];
  is_active: boolean;
}
