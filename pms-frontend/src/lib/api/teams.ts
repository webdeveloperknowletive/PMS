import { apiClient } from "./client";
import { createCrudApi } from "./crud-factory";
import type {
  Team,
  TeamCreate,
  TeamLead,
  TeamLeadCreate,
  TeamMember,
  TeamMemberCreate,
  TeamMemberUpdate,
  TeamUpdate,
} from "@/types/team";

const base = createCrudApi<Team, TeamCreate, TeamUpdate>("/teams", "team_id");

export const teamsApi = {
  ...base,

  /** GET /teams/{team_id}/members */
  getMembers: async (teamId: string): Promise<TeamMember[]> => {
    const { data } = await apiClient.get<TeamMember[]>(`/teams/${teamId}/members`);
    return data;
  },
/** POST /teams/{team_id}/members — team_id is required in the body by the backend schema, so we set it from the URL param */
  addMember: async (teamId: string, payload: Omit<TeamMemberCreate, "team_id">): Promise<TeamMember> => {
    const { data } = await apiClient.post<TeamMember>(`/teams/${teamId}/members`, {
      ...payload,
      team_id: teamId,
    });
    return data;
  },

  /** PUT /teams/{team_id}/members/{member_id} */
  updateMember: async (teamId: string, memberId: string, payload: TeamMemberUpdate): Promise<TeamMember> => {
    const { data } = await apiClient.put<TeamMember>(`/teams/${teamId}/members/${memberId}`, payload);
    return data;
  },

  /** DELETE /teams/{team_id}/members/{member_id} */
  removeMember: async (teamId: string, memberId: string): Promise<void> => {
    await apiClient.delete(`/teams/${teamId}/members/${memberId}`);
  },
};

/**
 * Team Leads — the endpoints we wired up on the backend (see teams/router.py).
 * A "team lead" is a promoted user: teams.team_lead_id points here, not
 * directly at users.user_id, so a user must have a TeamLead record before
 * they can be assigned to lead any team.
 */
export const teamLeadsApi = {
  list: async (): Promise<TeamLead[]> => {
    const { data } = await apiClient.get<TeamLead[]>("/teams/leads");
    return data;
  },
  get: async (teamLeadId: string): Promise<TeamLead> => {
    const { data } = await apiClient.get<TeamLead>(`/teams/leads/${teamLeadId}`);
    return data;
  },
  getByUser: async (userId: string): Promise<TeamLead | null> => {
    try {
      const { data } = await apiClient.get<TeamLead>(`/teams/leads/by-user/${userId}`);
      return data;
    } catch {
      return null; // 404 = this user isn't a team lead yet, not an error state
    }
  },
  /** Promotes a user to team lead. Throws 409 (via getApiErrorMessage) if they already are one. */
  create: async (payload: TeamLeadCreate): Promise<TeamLead> => {
    const { data } = await apiClient.post<TeamLead>("/teams/leads", payload);
    return data;
  },
  remove: async (teamLeadId: string): Promise<void> => {
    await apiClient.delete(`/teams/leads/${teamLeadId}`);
  },
};