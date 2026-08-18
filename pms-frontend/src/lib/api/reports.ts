import { createCrudApi } from "./crud-factory";
import type { Report, ReportCreate, ReportUpdate } from "@/types/report";

export const reportsApi = createCrudApi<Report, ReportCreate, ReportUpdate>("/reports", "report_id");
