// ==========================================================
// AI Sprint Planning — mirrors ai/sprint_planning/schema.py
// ==========================================================
export interface AISprintPlanBase {
  project_id: string;
  generated_by?: string | null;
  sprint_name: string;
  sprint_goal: string;
  sprint_duration_days: number;
  suggested_tasks: unknown[];
  estimated_story_points?: number | null;
  ai_model: string;
  prompt: string;
  ai_response: Record<string, unknown>;
  confidence_score?: number | null;
  status: string;
}
export interface AISprintPlanCreate extends AISprintPlanBase {}
export interface AISprintPlanUpdate {
  sprint_name?: string;
  sprint_goal?: string;
  sprint_duration_days?: number;
  suggested_tasks?: unknown[];
  estimated_story_points?: number | null;
  status?: string;
}
export interface AISprintPlan extends AISprintPlanBase {
  sprint_plan_id: string;
  created_at: string;
  updated_at: string;
}

// ==========================================================
// AI Risk Prediction — mirrors ai/risk_prediction/schema.py
// ==========================================================
export type RiskLevel = "Low" | "Medium" | "High";

export interface AIRiskPredictionBase {
  project_id: string;
  task_id?: string | null;
  risk_type: string;
  risk_level: RiskLevel;
  probability: number;
  impact?: string | null;
  recommendation: string;
  ai_model: string;
  prompt: string;
  prediction_result: Record<string, unknown>;
  confidence_score?: number | null;
}
export interface AIRiskPredictionCreate extends AIRiskPredictionBase {}
export interface AIRiskPredictionUpdate {
  risk_type?: string;
  risk_level?: RiskLevel;
  probability?: number;
  impact?: string | null;
  recommendation?: string;
}
export interface AIRiskPrediction extends AIRiskPredictionBase {
  prediction_id: string;
  created_at: string;
}

// ==========================================================
// AI Document Generator — mirrors ai/doc_generator/schema.py
// ==========================================================
export interface AIDocumentGenerationBase {
  project_id: string;
  generated_by?: string | null;
  document_type: string;
  title: string;
  prompt: string;
  generated_content: string;
  document_url?: string | null;
  version: string;
  ai_model: string;
  status: string;
}
export interface AIDocumentGenerationCreate extends AIDocumentGenerationBase {}
/** What the UI actually sends now — the backend calls Groq itself and
 *  fills in generated_content/ai_model/status server-side. */
export interface AIDocumentGenerationRequest {
  project_id: string;
  document_type: string;
  title: string;
  prompt: string;
}
export interface AIDocumentGenerationUpdate {
  title?: string;
  document_url?: string | null;
  version?: string;
  status?: string;
}
export interface AIDocumentGeneration extends AIDocumentGenerationBase {
  document_generation_id: string;
  created_at: string;
}

// ==========================================================
// AI Task Estimation — mirrors ai/task_estimation/schema.py
// ==========================================================
export type Complexity = "Low" | "Medium" | "High";

export interface AITaskEstimationBase {
  task_id: string;
  project_id: string;
  estimated_hours: number;
  estimated_cost?: number | null;
  complexity: Complexity;
  story_points?: number | null;
  ai_reasoning?: string | null;
  prompt: string;
  ai_model: string;
  confidence_score?: number | null;
}
export interface AITaskEstimationCreate extends AITaskEstimationBase {}
export interface AITaskEstimationUpdate {
  estimated_hours?: number;
  estimated_cost?: number | null;
  complexity?: Complexity;
  story_points?: number | null;
  ai_reasoning?: string | null;
}
export interface AITaskEstimation extends AITaskEstimationBase {
  estimation_id: string;
  created_at: string;
}

// ==========================================================
// AI Meeting Summary — mirrors ai/meeting_summary/schema.py
// ==========================================================
export interface AIMeetingSummaryBase {
  project_id: string;
  created_by?: string | null;
  meeting_title: string;
  meeting_date: string;
  transcript: string;
  summary: string;
  action_items: unknown[];
  decisions?: unknown[] | null;
  attendees?: unknown[] | null;
  ai_model: string;
}
export interface AIMeetingSummaryCreate extends AIMeetingSummaryBase {}
export interface AIMeetingSummaryUpdate {
  meeting_title?: string;
  summary?: string;
  action_items?: unknown[];
  decisions?: unknown[] | null;
  attendees?: unknown[] | null;
}
export interface AIMeetingSummary extends AIMeetingSummaryBase {
  summary_id: string;
  created_at: string;
}
