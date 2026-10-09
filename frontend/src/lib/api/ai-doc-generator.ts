import { apiClient } from "./client";
import { createCrudApi } from "./crud-factory";
import type { AIDocumentGeneration, AIDocumentGenerationCreate, AIDocumentGenerationRequest, AIDocumentGenerationUpdate } from "@/types/ai";

export const aiDocGeneratorApi = createCrudApi<
  AIDocumentGeneration,
  AIDocumentGenerationCreate,
  AIDocumentGenerationUpdate
>("/ai/document-generations", "document_generation_id");

/**
 * The generic `.create()` above still expects the full DB-shaped payload
 * (generated_content, ai_model, etc.) — but the backend now only accepts
 * {project_id, document_type, title, prompt} and generates the rest
 * itself by calling Groq. Use this instead of aiDocGeneratorApi.create().
 */
export async function generateDocument(payload: AIDocumentGenerationRequest): Promise<AIDocumentGeneration> {
  const { data } = await apiClient.post<AIDocumentGeneration>("/ai/document-generations/", payload);
  return data;
}
