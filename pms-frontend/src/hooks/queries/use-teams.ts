"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { teamsApi, teamLeadsApi } from "@/lib/api/teams";
import type { TeamCreate, TeamMemberUpdate, TeamUpdate } from "@/types/team";

const TEAMS_KEY = "teams";
const MEMBERS_KEY = "team-members";
const LEADS_KEY = "team-leads";

export function useTeams() {
  return useQuery({
    queryKey: [TEAMS_KEY],
    queryFn: () => teamsApi.list({ limit: 500 }),
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TeamCreate) => teamsApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [TEAMS_KEY] }),
  });
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TeamUpdate }) => teamsApi.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [TEAMS_KEY] }),
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => teamsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [TEAMS_KEY] }),
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
    },
  });
}

export function useRemoveTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, memberId }: { teamId: string; memberId: string }) => teamsApi.removeMember(teamId, memberId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [MEMBERS_KEY, variables.teamId] });
    },
  });
}

export function useTeamLeads() {
  return useQuery({
    queryKey: [LEADS_KEY],
    queryFn: () => teamLeadsApi.list(),
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