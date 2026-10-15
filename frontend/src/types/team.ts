import type { TeamStatus } from "@/lib/constants";

export interface TeamLead {
  team_lead_id: string;
  user_id: string;
  created_at: string;
}

export interface TeamLeadCreate {
  user_id: string;
}

export interface TeamMemberCandidate {
  user_id: string;
  name: string;
  is_active: boolean;
  role_names: string[];
}

export interface TeamBase {
  project_id: string;
  team_lead_id: string;
  team_name: string;
  description?: string | null;
  max_members: number;
  status: TeamStatus;
}

export interface TeamCreate extends TeamBase {
  member_user_ids?: string[];
}

export interface TeamUpdate {
  team_lead_id?: string;
  team_name?: string;
  description?: string | null;
  max_members?: number;
  status?: TeamStatus;
}

export interface Team extends TeamBase {
  team_id: string;
  created_at: string;
  updated_at: string;
  members?: TeamMember[];
}

export interface TeamMemberBase {
  team_id: string;
  user_id: string;
  responsibility?: string | null;
}

export interface TeamMemberCreate extends TeamMemberBase {}

export interface TeamMemberUpdate {
  responsibility?: string | null;
}

export interface TeamMember extends TeamMemberBase {
  member_id: string;
  joined_at: string;
}
