import { apiClient } from "./client";
import type { AuditEvent } from "@/types/audit";

export type AuditFilters = { method?: string; from_date?: string; to_date?: string };

export const auditApi = {
  list: async (params: { skip: number; limit: number } & AuditFilters): Promise<AuditEvent[]> => {
    const { data } = await apiClient.get<AuditEvent[]>("/audit-logs/", { params });
    return data;
  },
  export: async (params: AuditFilters): Promise<Blob> => {
    const { data } = await apiClient.get<Blob>("/audit-logs/export", { params, responseType: "blob" });
    return data;
  },
};
