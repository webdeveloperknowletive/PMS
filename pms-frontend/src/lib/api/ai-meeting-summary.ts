import { createCrudApi } from "./crud-factory";
import type { AIMeetingSummary, AIMeetingSummaryCreate, AIMeetingSummaryUpdate } from "@/types/ai";

export const aiMeetingSummaryApi = createCrudApi<AIMeetingSummary, AIMeetingSummaryCreate, AIMeetingSummaryUpdate>(
  "/ai/meeting-summaries",
  "summary_id"
);
