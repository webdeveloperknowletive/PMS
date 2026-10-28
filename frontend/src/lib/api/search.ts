import { apiClient } from "./client";

export interface WorkspaceSearchResult {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  href: string;
  action?: "OPEN_CHAT";
  conversation_id?: string;
}

export const searchApi = {
  async global(query: string): Promise<WorkspaceSearchResult[]> {
    const { data } = await apiClient.get<WorkspaceSearchResult[]>("/search/global", { params: { q: query, limit: 12 } });
    return data;
  },
};
