import { createCrudApi } from "./crud-factory";
import type { AIRiskPrediction, AIRiskPredictionCreate, AIRiskPredictionUpdate } from "@/types/ai";

export const aiRiskPredictionApi = createCrudApi<AIRiskPrediction, AIRiskPredictionCreate, AIRiskPredictionUpdate>(
  "/ai/risk-predictions",
  "prediction_id"
);
