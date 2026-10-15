import { apiClient } from "./client";
import type { InvitationPreview, Organization, OrganizationInviteCreate, OrganizationInvitation } from "@/types/organization";

export const organizationsApi = {
  current: async (): Promise<Organization> => (await apiClient.get<Organization>("/organizations/current")).data,
  updateCurrent: async (payload: { name: string; slug: string }): Promise<Organization> => (await apiClient.patch<Organization>("/organizations/current", payload)).data,
  invitations: async (): Promise<OrganizationInvitation[]> => (await apiClient.get<OrganizationInvitation[]>("/organizations/invitations")).data,
  invite: async (payload: OrganizationInviteCreate): Promise<OrganizationInvitation> => (await apiClient.post<OrganizationInvitation>("/organizations/invitations", payload)).data,
  resendInvitation: async (id: string): Promise<OrganizationInvitation> => (await apiClient.post<OrganizationInvitation>(`/organizations/invitations/${id}/resend`)).data,
  revokeInvitation: async (id: string): Promise<void> => { await apiClient.delete(`/organizations/invitations/${id}`); },
  acceptInvitation: async (payload: { token: string; name: string; password: string; accepted_terms: boolean }): Promise<{ user_id: string; organization: Organization }> =>
    (await apiClient.post("/organizations/invitations/accept", payload)).data,
  previewInvitation: async (token: string): Promise<InvitationPreview> =>
    (await apiClient.get<InvitationPreview>("/organizations/invitations/preview", { params: { token } })).data,
};
