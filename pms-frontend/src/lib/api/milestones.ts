import { createCrudApi } from "./crud-factory";
import type { Milestone, MilestoneCreate, MilestoneUpdate } from "@/types/milestone";

export const milestonesApi = createCrudApi<Milestone, MilestoneCreate, MilestoneUpdate>(
  "/milestones",
  "milestone_id"
);
