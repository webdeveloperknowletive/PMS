import { apiClient } from "./client";
import type { AIDocumentGeneration, AIDocumentGenerationRequest, GeneratedDocumentPreview } from "@/types/ai";

export const aiDocGeneratorApi = {
  list: async (): Promise<AIDocumentGeneration[]> => (await apiClient.get<AIDocumentGeneration[]>("/ai/documentation/")).data,
  get: async (id: string): Promise<AIDocumentGeneration> => (await apiClient.get<AIDocumentGeneration>(`/ai/documentation/${id}`)).data,
  remove: async (id: string): Promise<void> => { await apiClient.delete(`/ai/documentation/${id}`); },
  publish: async (id: string): Promise<AIDocumentGeneration> => (await apiClient.post<AIDocumentGeneration>(`/ai/documentation/${id}/publish`, {})).data,
};

export async function generateDocument(payload: AIDocumentGenerationRequest): Promise<GeneratedDocumentPreview> {
  return (await apiClient.post<GeneratedDocumentPreview>("/ai/documentation/generate", payload)).data;
}

export async function saveDocument(payload: {
  project_id: string;
  document_type: string;
  title: string;
  content: Record<string, unknown>;
  ai_model: string;
}): Promise<AIDocumentGeneration> {
  return (await apiClient.post<AIDocumentGeneration>("/ai/documentation/save", payload)).data;
}
