import { apiClient } from "./client";

export interface PlatformOverview {
  total_organizations: number;
  total_users: number;
  active_users_7d: number;
  active_users_30d: number;
  workspace_statuses: Record<string, number>;
  subscription_statuses: Record<string, number>;
  recent_organizations: Array<{ organization_id: string; name: string; slug: string; created_at: string }>;
}

export interface PlatformOrganization {
  organization_id: string; name: string; slug: string; status: string; plan_code: string;
  created_at: string; user_count: number; subscription_status?: string | null; trial_ends_at?: string | null;
  owner?: { name: string; email: string } | null;
  last_activity_at?: string | null;
}

export interface PlatformPage<T> { items: T[]; total: number; skip: number; limit: number }
export interface OrganizationFilters { search?: string; status?: string; subscription_status?: string; sort_by?: string; sort_order?: string; skip?: number; limit?: number }
export interface PlatformSubscription {
  subscription_id: string; organization_id: string; organization_name: string; organization_slug: string;
  plan_code: string; status: string; trial_ends_at?: string | null; period_ends_at?: string | null;
  cancel_at_period_end: boolean; billing_provider: string; created_at: string;
}

export interface PlatformOrganizationDetail extends PlatformOrganization {
  last_activity_at?: string | null;
  subscription?: { status: string; plan_code: string; trial_ends_at?: string | null; period_ends_at?: string | null; cancel_at_period_end: boolean } | null;
  users: Array<{ user_id: string; name: string; email: string; is_active: boolean; role_names: string[] }>;
  recent_activity: Array<{ event_id: string; actor_name: string; actor_roles: string; method: string; path: string; status_code: number; created_at: string }>;
}

export interface PlatformUser {
  user_id: string; name: string; email: string; organization_name: string; role_names: string[];
  is_active: boolean; is_email_verified: boolean; created_at: string;
}

export const platformApi = {
  overview: async () => (await apiClient.get<PlatformOverview>("/platform/overview")).data,
  organizations: async (filters: OrganizationFilters = {}) => {
    const { data } = await apiClient.get<PlatformPage<PlatformOrganization> | PlatformOrganization[]>("/platform/organizations", { params: filters });
    // Accept the previous list-only response while a locally running API reloads.
    if (Array.isArray(data)) return { items: data, total: data.length, skip: filters.skip ?? 0, limit: filters.limit ?? data.length };
    return { ...data, items: data.items ?? [], total: data.total ?? data.items?.length ?? 0 };
  },
  users: async (search?: string) => (await apiClient.get<PlatformUser[]>("/platform/users", { params: search ? { search } : {} })).data,
  auditLogs: async () => (await apiClient.get("/platform/audit-logs")).data,
  health: async () => (await apiClient.get<{ api: string; database: string; email_provider: string; checked_at: string }>("/platform/health")).data,
  plans: async () => (await apiClient.get<Array<{ plan_code: string; subscription_status: string; organization_count: number }>>("/platform/plans")).data,
  subscriptions: async (params: { skip?: number; limit?: number; plan_code?: string; subscription_status?: string } = {}) => (await apiClient.get<PlatformPage<PlatformSubscription>>("/platform/subscriptions", { params })).data,
  organization: async (id: string) => (await apiClient.get<PlatformOrganizationDetail>(`/platform/organizations/${id}`)).data,
  setOrganizationStatus: async (id: string, status: "ACTIVE" | "SUSPENDED") => (await apiClient.post(`/platform/organizations/${id}/status`, null, { params: { status } })).data,
  audit: async () => (await apiClient.get<Array<{ event_id: string; organization_id: string; actor_name: string; actor_roles: string; method: string; path: string; status_code: number; created_at: string }>>("/platform/audit-logs")).data,
};
