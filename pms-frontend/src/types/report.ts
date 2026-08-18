export type ReportFormat = "PDF" | "Excel" | "CSV";

export interface ReportBase {
  project_id: string;
  generated_by?: string | null;
  report_name: string;
  report_type: string;
  report_format: ReportFormat;
  file_url?: string | null;
  status: string;
}

export interface ReportCreate extends ReportBase {}

export interface ReportUpdate {
  file_url?: string | null;
  status?: string;
}

export interface Report extends ReportBase {
  report_id: string;
  generated_at: string;
}
