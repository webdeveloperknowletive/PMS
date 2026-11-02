"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { RecordDetailPage, type DetailField } from "@/components/shared/record-detail-page";
import { useUpdateWorkflow, useWorkflows } from "@/hooks/queries/use-workflows";
import { useTeamLeads } from "@/hooks/queries/use-teams";
import { useUsers } from "@/hooks/queries/use-users";
import { usePermissions } from "@/hooks/use-permissions";
import { getApiErrorMessage } from "@/lib/api/client";
import { Pencil } from "lucide-react";
import { TASK_STATUSES, WORKFLOW_STATUSES, WORKFLOW_TYPES } from "@/lib/constants";
import type { WorkflowUpdate } from "@/types/workflow";
export default function WorkflowDetailPage() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const { data = [], isLoading } = useWorkflows();
  const update = useUpdateWorkflow();
  const { data: leads = [] } = useTeamLeads();
  const { data: users = [] } = useUsers();
  const { canManageWorkflow } = usePermissions();
  const item = data.find((entry) => entry.workflow_id === workflowId);
  if (isLoading) return <p>Loading workflow…</p>;
  if (!item) return <p>Workflow unavailable.</p>;
  const save = async (payload: WorkflowUpdate) => { await update.mutateAsync({ id: workflowId, payload }); };
  const fields: DetailField[] = [
    { label: "Name", key: "workflow_name", value: item.workflow_name, required: true },
    { label: "Type", key: "workflow_type", value: item.workflow_type, type: "select", options: WORKFLOW_TYPES.map((value) => ({ value, label: value })) },
    { label: "Status", key: "status", value: item.status, type: "select", options: WORKFLOW_STATUSES.map((value) => ({ value, label: value })) },
    { label: "Default", key: "is_default", value: item.is_default ? "yes" : "no", type: "select", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }], parse: (value) => value === "yes" },
    { label: "Team lead", key: "team_lead_id", value: item.team_lead_id, type: "select", options: leads.map((lead) => ({ value: lead.team_lead_id, label: users.find((user) => user.user_id === lead.user_id)?.name ?? lead.user_id })), display: users.find((user) => user.user_id === leads.find((lead) => lead.team_lead_id === item.team_lead_id)?.user_id)?.name },
    { label: "Project", value: item.project_id, display: <Link href={"/projects/" + item.project_id} className="text-[#0c66e4] hover:underline">Open project</Link> },
    { label: "Description", key: "description", value: item.description, type: "textarea", parse: (value) => value || null },
  ];
  return <RecordDetailPage title={item.workflow_name} subtitle="Workflow" backHref="/workflow" backLabel="All workflows" fields={fields} canEdit={canManageWorkflow} onSave={async (key, value) => save({ [key]: value })}>
    <section className="rounded-md border border-[#dfe1e6] bg-white p-5 shadow-sm"><h2 className="mb-3 font-semibold">Allowed transitions</h2><div className="space-y-4">{TASK_STATUSES.map((from) => <div key={from}><p className="mb-1 text-xs font-semibold">{from}</p><div className="grid grid-cols-2 gap-1">{TASK_STATUSES.filter((to) => to !== from).map((to) => <label key={to} className="group/transition flex items-center gap-1 rounded p-1 text-[11px] hover:bg-[#f1f2f4]"><input type="checkbox" checked={(item.allowed_transitions[from] ?? []).includes(to)} disabled={!canManageWorkflow || update.isPending} onChange={(event) => { const current = item.allowed_transitions[from] ?? []; const next = event.target.checked ? [...current, to] : current.filter((status) => status !== to); void save({ allowed_transitions: { ...item.allowed_transitions, [from]: next } }).then(() => toast.success("Transition updated")).catch((error) => toast.error(getApiErrorMessage(error))); }} />{to}{canManageWorkflow && <Pencil className="ml-auto h-3 w-3 text-[#626f86] opacity-0 group-hover/transition:opacity-100" />}</label>)}</div></div>)}</div></section>
  </RecordDetailPage>;
}
