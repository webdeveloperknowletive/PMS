"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Activity, AlertTriangle, CalendarDays, CheckCircle2, Clock3, FileText, Loader2, Plus, Sparkles, Trash2, WandSparkles } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useProjects } from "@/hooks/queries/use-projects";
import { useTasks } from "@/hooks/queries/use-tasks";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/utils";
import type { Project } from "@/types/project";
import type { Task } from "@/types/task";
import { usePermissions } from "@/hooks/use-permissions";

type AiKind = "sprint" | "estimate" | "risk" | "meeting";
type AiRecord = Record<string, unknown>;

const MODULES: Record<AiKind, { title: string; description: string; endpoint: string; idField: string; tint: string; icon: typeof Sparkles }> = {
  sprint: { title: "AI Sprint Planning", description: "Shape a focused sprint from your active project work.", endpoint: "/ai/sprint-plans", idField: "sprint_plan_id", tint: "from-violet-600 to-indigo-500", icon: Sparkles },
  estimate: { title: "AI Task Estimation", description: "Get an effort estimate grounded in the task details.", endpoint: "/ai/task-estimations", idField: "estimation_id", tint: "from-sky-500 to-blue-600", icon: Activity },
  risk: { title: "AI Risk Prediction", description: "Surface project delivery risks and practical mitigations.", endpoint: "/ai/risk-predictions", idField: "prediction_id", tint: "from-rose-500 to-orange-500", icon: AlertTriangle },
  meeting: { title: "AI Meeting Summary", description: "Turn a transcript into decisions and clear next steps.", endpoint: "/ai/meeting-summaries", idField: "summary_id", tint: "from-emerald-500 to-teal-600", icon: FileText },
};

const NONE = "__none__";
const val = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
const num = (value: unknown) => typeof value === "number" ? value : Number(value ?? 0);

export function AiWorkspacePage({ kind }: { kind: AiKind }) {
  const config = MODULES[kind];
  const Icon = config.icon;
  const queryClient = useQueryClient();
  const { data: projects } = useProjects();
  const { data: tasks } = useTasks({ limit: 500 });
  const { canUseAI } = usePermissions();
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [duration, setDuration] = useState("10");
  const [hourlyRate, setHourlyRate] = useState("");
  const [prompt, setPrompt] = useState("");
  const [transcript, setTranscript] = useState("");
  const [meetingAt, setMeetingAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [selected, setSelected] = useState<AiRecord | null>(null);
  const [deleting, setDeleting] = useState<AiRecord | null>(null);

  const listQuery = useQuery({
    queryKey: [config.endpoint],
    queryFn: async () => (await apiClient.get<AiRecord[]>(`${config.endpoint}/`, { params: { limit: 100 } })).data,
  });
  const generateMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => (await apiClient.post<AiRecord>(`${config.endpoint}/generate`, payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [config.endpoint] });
      toast.success("AI result generated and saved");
      setPrompt(""); setTranscript(""); setGoal("");
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });
  const deleteMutation = useMutation({
    mutationFn: async (record: AiRecord) => { await apiClient.delete(`${config.endpoint}/${val(record[config.idField])}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [config.endpoint] }); setDeleting(null); toast.success("AI record removed"); },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const filteredTasks = useMemo(() => (tasks ?? []).filter((task) => !projectId || task.project_id === projectId), [tasks, projectId]);
  const projectName = (id: string) => projects?.find((project) => project.project_id === id)?.project_name ?? "Project";
  const taskName = (id: string) => tasks?.find((task) => task.task_id === id)?.task_name ?? "Task";

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    let payload: Record<string, unknown>;
    if (kind === "sprint") payload = { project_id: projectId, sprint_name: name.trim(), sprint_goal: goal.trim(), sprint_duration_days: Number(duration), prompt: prompt.trim() };
    else if (kind === "estimate") payload = { task_id: taskId, hourly_rate: hourlyRate ? Number(hourlyRate) : null, prompt: prompt.trim() };
    else if (kind === "risk") payload = { project_id: projectId, task_id: taskId && taskId !== NONE ? taskId : null, prompt: prompt.trim() || "Review the current project information and identify the most material delivery risk." };
    else payload = { project_id: projectId, meeting_title: name.trim(), meeting_date: new Date(meetingAt).toISOString(), transcript: transcript.trim() };
    generateMutation.mutate(payload);
  };

  const canSubmit = kind === "sprint" ? !!projectId && !!name.trim() && !!goal.trim() && Number(duration) > 0
    : kind === "estimate" ? !!taskId
    : kind === "risk" ? !!projectId
    : !!projectId && !!name.trim() && !!transcript.trim();

  const titleFor = (item: AiRecord) => kind === "sprint" ? val(item.sprint_name) : kind === "estimate" ? taskName(val(item.task_id)) : kind === "risk" ? val(item.risk_type, "Project risk") : val(item.meeting_title);
  const summaryFor = (item: AiRecord) => kind === "sprint" ? val(item.sprint_goal) : kind === "estimate" ? val(item.ai_reasoning) : kind === "risk" ? val(item.recommendation) : val(item.summary);
  const projectFor = (item: AiRecord) => projectName(val(item.project_id));
  const badgesFor = (item: AiRecord) => kind === "sprint" ? [`${num(item.sprint_duration_days)} days`, `${num(item.estimated_story_points)} points`]
    : kind === "estimate" ? [`${num(item.estimated_hours)} hours`, val(item.complexity)]
    : kind === "risk" ? [val(item.risk_level), `${num(item.probability)}% probability`]
    : [`${Array.isArray(item.action_items) ? item.action_items.length : 0} action items`, formatDate(val(item.meeting_date))];

  return (
    <div className="workspace-page animate-enter">
      <PageHeader title={config.title} description={config.description} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        {canUseAI && <Card className="h-fit overflow-hidden border-white/90">
          <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-white to-violet-50/50 px-5 py-5 sm:px-6">
            <div className="flex items-center gap-3"><div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${config.tint} text-white shadow-lg`}><WandSparkles className="h-5 w-5" /></div><div><CardTitle className="text-base">Create with AI</CardTitle><p className="mt-1 text-xs text-slate-500">Your result is saved to this workspace.</p></div></div>
          </CardHeader>
          <CardContent className="p-5 sm:p-6">
            <form onSubmit={submit} className="space-y-4">
              {kind !== "estimate" && <div className="space-y-2"><Label>Project</Label><Select value={projectId} onValueChange={(value) => { setProjectId(value); setTaskId(""); }}><SelectTrigger><SelectValue placeholder="Choose a project" /></SelectTrigger><SelectContent>{(projects ?? []).map((project: Project) => <SelectItem key={project.project_id} value={project.project_id}>{project.project_name}</SelectItem>)}</SelectContent></Select></div>}
              {kind === "estimate" && <div className="space-y-2"><Label>Task</Label><Select value={taskId} onValueChange={setTaskId}><SelectTrigger><SelectValue placeholder="Choose a task" /></SelectTrigger><SelectContent>{(tasks ?? []).map((task: Task) => <SelectItem key={task.task_id} value={task.task_id}>{task.task_name}</SelectItem>)}</SelectContent></Select></div>}
              {kind === "sprint" && <>
                <div className="space-y-2"><Label htmlFor="sprint-name">Sprint name</Label><Input id="sprint-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Sprint 08 — Checkout improvements" maxLength={150} required /></div>
                <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="sprint-days">Duration</Label><div className="relative"><Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input id="sprint-days" className="pl-9" type="number" min="1" max="90" value={duration} onChange={(event) => setDuration(event.target.value)} required /></div></div><div className="space-y-2"><Label>Existing tasks</Label><div className="flex h-10 items-center rounded-xl bg-slate-50 px-3 text-sm text-slate-600">{projectId ? filteredTasks.length : "Choose a project"}</div></div></div>
                <div className="space-y-2"><Label htmlFor="sprint-goal">Sprint goal</Label><Textarea id="sprint-goal" value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="What outcome should the team deliver?" rows={3} required /></div>
                <div className="space-y-2"><Label htmlFor="sprint-prompt">Additional direction <span className="font-normal text-slate-400">· optional</span></Label><Textarea id="sprint-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Capacity, dependencies, or priorities to consider..." rows={2} /></div>
              </>}
              {kind === "estimate" && <>
                <div className="space-y-2"><Label htmlFor="hourly-rate">Hourly rate <span className="font-normal text-slate-400">· optional</span></Label><Input id="hourly-rate" type="number" min="0" step="0.01" value={hourlyRate} onChange={(event) => setHourlyRate(event.target.value)} placeholder="e.g. 85" /></div>
                <div className="space-y-2"><Label htmlFor="estimate-prompt">Additional context <span className="font-normal text-slate-400">· optional</span></Label><Textarea id="estimate-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Constraints, integrations, or quality requirements..." rows={4} /></div>
              </>}
              {kind === "risk" && <>
                <div className="space-y-2"><Label>Related task <span className="font-normal text-slate-400">· optional</span></Label><Select value={taskId || NONE} onValueChange={(value) => setTaskId(value === NONE ? "" : value)}><SelectTrigger><SelectValue placeholder="All project tasks" /></SelectTrigger><SelectContent><SelectItem value={NONE}>All project tasks</SelectItem>{filteredTasks.map((task) => <SelectItem key={task.task_id} value={task.task_id}>{task.task_name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label htmlFor="risk-prompt">What should the AI focus on?</Label><Textarea id="risk-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="For example: identify schedule or dependency risks for the next release." rows={5} /></div>
              </>}
              {kind === "meeting" && <>
                <div className="space-y-2"><Label htmlFor="meeting-title">Meeting title</Label><Input id="meeting-title" value={name} onChange={(event) => setName(event.target.value)} placeholder="Weekly product sync" maxLength={255} required /></div>
                <div className="space-y-2"><Label htmlFor="meeting-date">Meeting date and time</Label><div className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input id="meeting-date" className="pl-9" type="datetime-local" value={meetingAt} onChange={(event) => setMeetingAt(event.target.value)} required /></div></div>
                <div className="space-y-2"><Label htmlFor="meeting-transcript">Transcript</Label><Textarea id="meeting-transcript" value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="Paste the meeting transcript or notes..." rows={7} required /></div>
              </>}
              <div className="rounded-xl border border-violet-100 bg-violet-50/70 px-3.5 py-3 text-xs leading-5 text-violet-800"><Sparkles className="mr-1.5 inline h-3.5 w-3.5" />Uses your project context and the configured server-side AI provider. The generated result is stored for your team.</div>
              <Button type="submit" disabled={!canSubmit || generateMutation.isPending} className="w-full sm:w-auto">
                {generateMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : <><WandSparkles className="h-4 w-4" /> Generate {kind === "sprint" ? "sprint plan" : kind === "estimate" ? "estimate" : kind === "risk" ? "risk assessment" : "meeting summary"}</>}
              </Button>
            </form>
          </CardContent>
        </Card>}

        <section className="space-y-4">
          <div className="flex items-end justify-between gap-3"><div><h2 className="text-base font-bold text-slate-900">Recent results</h2><p className="mt-1 text-xs text-slate-500">Your saved AI workspace history</p></div><Badge variant="secondary" className="rounded-full bg-white text-slate-600">{listQuery.data?.length ?? 0} saved</Badge></div>
          {listQuery.isLoading ? <div className="space-y-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-28 w-full" />)}</div>
            : listQuery.isError ? <Card><CardContent className="p-6 text-sm text-rose-700">{getApiErrorMessage(listQuery.error)}</CardContent></Card>
            : !listQuery.data?.length ? <Card className="border-dashed border-slate-300 bg-white/60"><CardContent className="flex flex-col items-center px-6 py-12 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><Icon className="h-6 w-6" /></div><h3 className="mt-4 text-sm font-semibold text-slate-800">No results yet</h3><p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">Complete the form to generate the first result for your workspace.</p></CardContent></Card>
            : <div className="space-y-3">{listQuery.data.map((item) => <Card key={val(item[config.idField])} className="group border-white/90 transition hover:-translate-y-0.5 hover:border-violet-100 hover:shadow-md"><CardContent className="p-4 sm:p-5"><div className="flex items-start gap-3"><div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${config.tint} text-white`}><Icon className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold text-slate-900">{titleFor(item)}</h3>{kind === "risk" && <Badge variant="outline" className="rounded-full">{val(item.risk_level)}</Badge>}</div><p className="mt-1 truncate text-xs text-slate-500">{projectFor(item)} · {formatDate(val(item.created_at))}</p></div>{canUseAI && <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-slate-400 hover:text-rose-600" aria-label="Delete result" onClick={() => setDeleting(item)}><Trash2 className="h-4 w-4" /></Button>}</div><p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-600">{summaryFor(item) || "Generated result ready to review."}</p><div className="mt-3 flex flex-wrap items-center gap-2">{badgesFor(item).filter(Boolean).map((badge) => <Badge key={badge} variant="secondary" className="rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">{badge}</Badge>)}<Button variant="link" size="sm" className="ml-auto h-7 px-1 text-xs" onClick={() => setSelected(item)}>View details</Button></div></CardContent></Card>)}</div>}
        </section>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{selected ? titleFor(selected) : "AI result"}</DialogTitle><DialogDescription>{selected ? `${projectFor(selected)} · Generated ${formatDate(val(selected.created_at))}` : ""}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl bg-violet-50/80 p-4"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-violet-700">Summary</p><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{selected ? summaryFor(selected) : ""}</p></div>
            <pre className="max-h-80 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">{selected ? JSON.stringify(selected.ai_response ?? selected.prediction_result ?? { action_items: selected.action_items, decisions: selected.decisions, attendees: selected.attendees, confidence_score: selected.confidence_score }, null, 2) : ""}</pre>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)} title="Remove this AI result?" description="This will permanently remove the saved result from your workspace." onConfirm={() => deleting && deleteMutation.mutate(deleting)} isLoading={deleteMutation.isPending} />
    </div>
  );
}
