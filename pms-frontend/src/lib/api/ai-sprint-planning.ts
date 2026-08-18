import { createCrudApi } from "./crud-factory";
import type { AISprintPlan, AISprintPlanCreate, AISprintPlanUpdate } from "@/types/ai";

export const aiSprintPlanningApi = createCrudApi<AISprintPlan, AISprintPlanCreate, AISprintPlanUpdate>(
  "/ai/sprint-plans",
  "sprint_plan_id"
);
