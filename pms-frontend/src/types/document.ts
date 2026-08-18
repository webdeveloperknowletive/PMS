export interface DocumentBase {
  project_id: string;
  title: string;
  file_url?: string | null;
  version: string;
}

export interface DocumentCreate extends DocumentBase {}

export interface DocumentUpdate {
  title?: string;
  file_url?: string | null;
  version?: string;
}

export interface Document extends DocumentBase {
  document_id: string;
  created_at: string;
}
