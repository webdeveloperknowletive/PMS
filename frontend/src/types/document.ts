export interface DocumentBase {
  project_id: string;
  title: string;
  file_url?: string | null;
  version: string;
  resource_type: "FILE" | "GITHUB" | "DRIVE";
}

export interface DocumentCreate extends DocumentBase {}

export interface DocumentUpdate {
  title?: string;
  file_url?: string | null;
  version?: string;
  resource_type?: "FILE" | "GITHUB" | "DRIVE";
}

export interface Document extends DocumentBase {
  document_id: string;
  created_at: string;
  updated_at?: string | null;
  original_filename?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  created_by?: string | null;
  updated_by?: string | null;
}
