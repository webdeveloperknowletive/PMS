"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RecordDetailPage, type DetailField } from "@/components/shared/record-detail-page";
import { Button } from "@/components/ui/button";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { usePermissions } from "@/hooks/use-permissions";

type Kind = "sprint" | "estimate" | "risk" | "meeting";
type RecordData = Record<string, unknown>;
const config: Record<Kind, { endpoint: string; id: string; back: string; title: string }> = {
  sprint: { endpoint: "/ai/sprint-plans", id: "sprint_plan_id", back: "/ai/sprint-planning", title: "AI sprint plan" },
  estimate: { endpoint: "/ai/task-estimations", id: "estimation_id", back: "/ai/task-estimation", title: "AI task estimate" },
  risk: { endpoint: "/ai/risk-predictions", id: "prediction_id", back: "/ai/risk-prediction", title: "AI risk prediction" },
  meeting: { endpoint: "/ai/meeting-summaries", id: "summary_id", back: "/ai/meeting-summary", title: "AI meeting summary" },
};
const string = (value: unknown) => value == null ? "" : String(value);
const number = (value: string) => value ? Number(value) : null;
const json = (value: string) => JSON.parse(value);
const validJson = (value: string) => { try { JSON.parse(value); return undefined; } catch { return "Enter valid JSON"; } };
const field = (label: string, key: string, value: unknown, options?: DetailField["options"]): DetailField => ({ label, key, value: string(value), type: options ? "select" : "text", options });
const textArea = (label: string, key: string, value: unknown): DetailField => ({ label, key, value: string(value), type: "textarea" });
const jsonField = (label: string, key: string, value: unknown): DetailField => ({ label, key, value: JSON.stringify(value ?? [], null, 2), type: "textarea", validate: validJson, parse: json });

export function AiResultDetail({ kind }: { kind: Kind }) {
  const { recordId } = useParams<{ recordId: string }>();
  const meta = config[kind];
  const queryClient = useQueryClient();
  const { canUseAI } = usePermissions();
  const [selected, setSelected] = useState<number[]>([]);
  const itemQuery = useQuery({ queryKey: [meta.endpoint, recordId], queryFn: async () => (await apiClient.get<RecordData>(meta.endpoint + "/" + recordId)).data });
  const update = useMutation({
    mutationFn: async (payload: RecordData) => (await apiClient.put<RecordData>(meta.endpoint + "/" + recordId, payload)).data,
    onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: [meta.endpoint] }), queryClient.invalidateQueries({ queryKey: [meta.endpoint, recordId] })]); },
  });
  const apply = useMutation({
    mutationFn: async () => {
      if (kind === "sprint") {
        const suggestions = Array.isArray(itemQuery.data?.suggested_tasks) ? itemQuery.data.suggested_tasks : [];
        const selected_task_ids = selected.map((index) => suggestions[index]).map((entry) => entry && typeof entry === "object" ? string((entry as RecordData).task_id) : "").filter(Boolean);
        return (await apiClient.post(meta.endpoint + "/" + recordId + "/apply", { selected_task_ids })).data;
      }
      if (kind === "estimate") return (await apiClient.post(meta.endpoint + "/" + recordId + "/apply", {})).data;
      return (await apiClient.post(meta.endpoint + "/" + recordId + "/apply-actions", { item_indexes: selected })).data;
    },
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: [meta.endpoint] }), queryClient.invalidateQueries({ queryKey: [meta.endpoint, recordId] }), queryClient.invalidateQueries({ queryKey: ["tasks"] }), queryClient.invalidateQueries({ queryKey: ["task-sprints"] })]);
      setSelected([]);
      toast.success("Suggestions applied");
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  if (itemQuery.isLoading) return <p>Loading AI result…</p>;
  if (itemQuery.isError || !itemQuery.data) return <p>AI result unavailable.</p>;
  const item = itemQuery.data;
  const fields: DetailField[] = kind === "sprint" ? [
    field("Sprint name", "sprint_name", item.sprint_name), textArea("Sprint goal", "sprint_goal", item.sprint_goal),
    { ...field("Duration (days)", "sprint_duration_days", item.sprint_duration_days), type: "number", parse: Number },
    { ...field("Story points", "estimated_story_points", item.estimated_story_points), type: "number", parse: number },
    field("Status", "status", item.status), jsonField("Suggested tasks", "suggested_tasks", item.suggested_tasks),
  ] : kind === "estimate" ? [
    { ...field("Estimated hours", "estimated_hours", item.estimated_hours), type: "number", parse: Number },
    { ...field("Estimated cost", "estimated_cost", item.estimated_cost), type: "number", parse: number },
    field("Complexity", "complexity", item.complexity, ["Low","Medium","High"].map((value) => ({ value, label: value }))),
    { ...field("Story points", "story_points", item.story_points), type: "number", parse: number },
    textArea("Reasoning", "ai_reasoning", item.ai_reasoning),
  ] : kind === "risk" ? [
    field("Risk type", "risk_type", item.risk_type),
    field("Risk level", "risk_level", item.risk_level, ["Low","Medium","High"].map((value) => ({ value, label: value }))),
    { ...field("Probability (%)", "probability", item.probability), type: "number", parse: Number },
    textArea("Impact", "impact", item.impact), textArea("Recommendation", "recommendation", item.recommendation),
  ] : [
    field("Meeting title", "meeting_title", item.meeting_title),
    textArea("Summary", "summary", item.summary),
    jsonField("Action items", "action_items", item.action_items),
    jsonField("Decisions", "decisions", item.decisions),
    jsonField("Attendees", "attendees", item.attendees),
  ];
  const title = string(item.sprint_name ?? item.meeting_title ?? item.risk_type ?? "Task estimate");
  const suggestions = kind === "sprint" ? item.suggested_tasks : kind === "meeting" ? item.action_items : null;
  const entries = Array.isArray(suggestions) ? suggestions : [];
  return <RecordDetailPage title={title} subtitle={meta.title} backHref={meta.back} backLabel="All results" fields={fields} canEdit={canUseAI} onSave={async (key, value) => { await update.mutateAsync({ [key]: value }); }}>
    <div className="space-y-4 rounded-md border border-[#dfe1e6] bg-white p-5 shadow-sm">
      <h2 className="font-semibold">Apply to workspace</h2>
      {entries.map((entry, index) => { const data = entry && typeof entry === "object" ? entry as RecordData : {}; const label = string(data.task_name ?? data.task ?? data.title ?? entry); const alreadyApplied = kind === "meeting" && Array.isArray(item.applied_action_items) && item.applied_action_items.includes(index); return <label key={index} className="flex gap-2 rounded border p-2 text-xs"><input type="checkbox" checked={alreadyApplied || selected.includes(index)} disabled={alreadyApplied || !canUseAI} onChange={(event) => setSelected((current) => event.target.checked ? [...current, index] : current.filter((value) => value !== index))} /><span>{label}</span></label>; })}
      {kind === "estimate" && <p className="text-xs text-[#626f86]">Apply the estimate to its work item.</p>}
      {kind === "risk" && <p className="text-xs text-[#626f86]">Risk predictions are advisory.</p>}
      {kind !== "risk" && canUseAI && <Button size="sm" disabled={apply.isPending || (kind !== "estimate" && selected.length === 0) || (kind === "sprint" && !!item.applied_sprint_id) || (kind === "estimate" && !!item.is_applied)} onClick={() => void apply.mutateAsync()}>{apply.isPending ? "Applying…" : item.applied_sprint_id || item.is_applied ? "Already applied" : kind === "sprint" ? "Create sprint" : kind === "estimate" ? "Apply estimate" : "Create selected tasks"}</Button>}
    </div>
  </RecordDetailPage>;
}
