"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { teamsApi, teamLeadsApi } from "@/lib/api/teams";
import type { TeamCreate, TeamMemberUpdate, TeamUpdate } from "@/types/team";
import { useAuthStore } from "@/store/auth-store";

const TEAMS_KEY = "teams";
const MEMBERS_KEY = "team-members";
const LEADS_KEY = "team-leads";

export function useTeams(enabled = true) {
  return useQuery({
    queryKey: [TEAMS_KEY],
    queryFn: () => teamsApi.list({ limit: 500 }),
    enabled,
    // Team Leads and Project Managers use separate sessions, so local query
    // invalidation cannot refresh the other dashboard after a team is deleted.
    refetchInterval: enabled ? 5_000 : false,
  });
}

export function useTeamMemberCandidates(enabled = true) {
  const userId = useAuthStore((state) => state.user?.user_id);
  return useQuery({
    queryKey: ["team-member-candidates", userId],
    queryFn: () => teamsApi.getMemberCandidates(),
    enabled,
  });
}

export function useAvailableTeamMembers(teamId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["team-available-members", teamId],
    queryFn: () => teamsApi.getAvailableMembers(teamId!),
    enabled: !!teamId && enabled,
    refetchInterval: 5_000,
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TeamCreate) => teamsApi.create(payload),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: [TEAMS_KEY] }),
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
    ]),
  });
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TeamUpdate }) => teamsApi.update(id, payload),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: [TEAMS_KEY] }),
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
    ]),
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => teamsApi.remove(id),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: [TEAMS_KEY] }),
      // Removing a team detaches its tasks from the team in the API. Refresh
      // task and board views as well as team lists in the deleting session.
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["kanban-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["team-available-members"] }),
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
    ]),
  });
}

export function useTeamMembers(teamId: string | undefined) {
  return useQuery({
    queryKey: [MEMBERS_KEY, teamId],
    queryFn: () => teamsApi.getMembers(teamId as string),
    enabled: !!teamId,
  });
}

export function useAddTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, userId, responsibility }: { teamId: string; userId: string; responsibility?: string }) =>
      teamsApi.addMember(teamId, { user_id: userId, responsibility: responsibility ?? null }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [MEMBERS_KEY, variables.teamId] });
      queryClient.invalidateQueries({ queryKey: [TEAMS_KEY] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
  });
}

export function useUpdateTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, memberId, payload }: { teamId: string; memberId: string; payload: TeamMemberUpdate }) =>
      teamsApi.updateMember(teamId, memberId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [MEMBERS_KEY, variables.teamId] });
      queryClient.invalidateQueries({ queryKey: [TEAMS_KEY] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
  });
}

export function useRemoveTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, memberId }: { teamId: string; memberId: string }) => teamsApi.removeMember(teamId, memberId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [MEMBERS_KEY, variables.teamId] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
  });
}

export function useTeamLeads(enabled = true) {
  return useQuery({
    queryKey: [LEADS_KEY],
    queryFn: () => teamLeadsApi.list(),
    enabled,
  });
}

/** Ensures the given user has a TeamLead record, creating one if they don't yet — used right before assigning them to lead a team. */
export function usePromoteToTeamLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const existing = await teamLeadsApi.getByUser(userId);
      if (existing) return existing;
      return teamLeadsApi.create({ user_id: userId });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [LEADS_KEY] }),
  });
}
