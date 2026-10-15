"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { organizationsApi } from "@/lib/api/organizations";
import type { OrganizationInviteCreate } from "@/types/organization";

export function useCurrentOrganization() {
  return useQuery({
    queryKey: ["current-organization"],
    queryFn: organizationsApi.current,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useUpdateCurrentOrganization() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; slug: string }) => organizationsApi.updateCurrent(payload),
    onSuccess: (organization) => client.setQueryData(["current-organization"], organization),
  });
}

export function useOrganizationInvitations(enabled = true) {
  return useQuery({ queryKey: ["organization-invitations"], queryFn: organizationsApi.invitations, enabled });
}

export function useInviteOrganizationMember() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: OrganizationInviteCreate) => organizationsApi.invite(payload),
    onSuccess: () => client.invalidateQueries({ queryKey: ["organization-invitations"] }),
  });
}

export function useRevokeOrganizationInvitation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => organizationsApi.revokeInvitation(id),
    onSuccess: () => client.invalidateQueries({ queryKey: ["organization-invitations"] }),
  });
}

export function useResendOrganizationInvitation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => organizationsApi.resendInvitation(id),
    onSuccess: () => client.invalidateQueries({ queryKey: ["organization-invitations"] }),
  });
}
