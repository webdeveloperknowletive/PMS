import { createCrudApi } from "./crud-factory";
import type { AIDocumentGeneration, AIDocumentGenerationCreate, AIDocumentGenerationUpdate } from "@/types/ai";

export const aiDocGeneratorApi = createCrudApi<
  AIDocumentGeneration,
  AIDocumentGenerationCreate,
  AIDocumentGenerationUpdate
>("/ai/document-generations", "document_generation_id");
