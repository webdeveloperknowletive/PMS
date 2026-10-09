import { createCrudApi } from "./crud-factory";
import type { Document, DocumentCreate, DocumentUpdate } from "@/types/document";
import { apiClient } from "./client";

const crud = createCrudApi<Document, DocumentCreate, DocumentUpdate>("/documents", "document_id");

export const documentsApi = {
  ...crud,
  upload: async (payload: { project_id: string; title: string; version: string; file: File }) => {
    const body = new FormData();
    body.append("project_id", payload.project_id);
    body.append("title", payload.title);
    body.append("version", payload.version);
    body.append("file", payload.file);
    // Let the browser add the multipart boundary. The shared client defaults
    // to JSON, which makes FastAPI reject these form fields with a 422.
    return (await apiClient.post<Document>("/documents/upload", body, { headers: { "Content-Type": undefined } })).data;
  },
  replaceFile: async (id: string, file: File) => {
    const body = new FormData();
    body.append("file", file);
    return (await apiClient.put<Document>(`/documents/${id}/file`, body, { headers: { "Content-Type": undefined } })).data;
  },
  download: async (id: string, filename: string) => {
    const response = await apiClient.get<Blob>(`/documents/${id}/download`, { responseType: "blob" });
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
