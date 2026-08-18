import { createCrudApi } from "./crud-factory";
import type { Document, DocumentCreate, DocumentUpdate } from "@/types/document";

export const documentsApi = createCrudApi<Document, DocumentCreate, DocumentUpdate>("/documents", "document_id");
