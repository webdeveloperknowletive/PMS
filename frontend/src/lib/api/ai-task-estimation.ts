import { createCrudApi } from "./crud-factory";
import type { AITaskEstimation, AITaskEstimationCreate, AITaskEstimationUpdate } from "@/types/ai";

export const aiTaskEstimationApi = createCrudApi<AITaskEstimation, AITaskEstimationCreate, AITaskEstimationUpdate>(
  "/ai/task-estimations",
  "estimation_id"
);
