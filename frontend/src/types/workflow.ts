export interface WorkflowBase {
  project_id: string;
  team_lead_id: string;
  workflow_name: string;
  description?: string | null;
  workflow_type: string;
  is_default: boolean;
  status: string;
}

export interface WorkflowCreate extends WorkflowBase {}

export interface WorkflowUpdate {
  team_lead_id?: string;
  workflow_name?: string;
  description?: string | null;
  workflow_type?: string;
  is_default?: boolean;
  status?: string;
}

export interface Workflow extends WorkflowBase {
  workflow_id: string;
  created_at: string;
  updated_at: string;
}
