"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KanbanCardDetailsDialog } from "@/components/modules/kanban/kanban-card-details-dialog";
import { useKanbanLabels } from "@/hooks/queries/use-kanban";
import { useTasks } from "@/hooks/queries/use-tasks";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuthStore } from "@/store/auth-store";
import type { Project } from "@/types/project";
import type { Task } from "@/types/task";
import { labelTextColor } from "@/lib/kanban-labels";

type CalendarView = "month" | "week" | "day";
const ALL = "__all__";
const STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "BLOCKED", "CANCELLED"] as const;
const STATUS_STYLE: Record<string, string> = {
  TODO: "border-slate-300 bg-slate-50 text-slate-700",
  IN_PROGRESS: "border-blue-300 bg-blue-50 text-blue-800",
  IN_REVIEW: "border-amber-300 bg-amber-50 text-amber-900",
  DONE: "border-emerald-300 bg-emerald-50 text-emerald-800",
  BLOCKED: "border-rose-300 bg-rose-50 text-rose-800",
  CANCELLED: "border-slate-200 bg-slate-50 text-slate-500",
};

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateValue(value?: string | null) {
  return value ? value.slice(0, 10) : null;
}

function datesForTask(task: Task) {
  const start = dateValue(task.start_date) ?? dateValue(task.due_date);
  const end = dateValue(task.due_date) ?? dateValue(task.start_date);
  return start && end ? { start, end } : null;
}

function coversDate(task: Task, key: string) {
  const range = datesForTask(task);
  return !!range && range.start <= key && key <= range.end;
}

function taskDeadlineState(task: Task, todayKey: string) {
  if (!task.due_date || task.status === "DONE" || task.status === "CANCELLED") return "normal";
  const due = dateValue(task.due_date)!;
  if (due < todayKey) return "overdue";
  const today = new Date(`${todayKey}T00:00:00`);
  const dueDay = new Date(`${due}T00:00:00`);
  const daysLeft = Math.round((dueDay.getTime() - today.getTime()) / 86400000);
  return daysLeft <= 3 ? "soon" : "normal";
}

export function KanbanCardCalendar({ projects = [] }: { projects?: Project[] }) {
  const { permissionCodes } = usePermissions();
  const currentUser = useAuthStore((state) => state.user);
  const canReadTasks = permissionCodes.some((code) => ["tasks.view", "tasks.team_view", "tasks.manage", "tasks.update", "tasks.update_assigned", "kanban.view", "kanban.tasks.view", "kanban.tasks.move", "roles.manage"].includes(code));
  const { data: tasks = [], isLoading, isError, error } = useTasks({ limit: 500 }, canReadTasks);
  const canReadKanbanLabels = permissionCodes.some((code) => ["kanban.tasks.view", "kanban.view", "kanban.tasks.move", "tasks.manage", "roles.manage"].includes(code));
  const { data: labels = [] } = useKanbanLabels(canReadTasks && canReadKanbanLabels);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [view, setView] = useState<CalendarView>("month");
  const [projectFilter, setProjectFilter] = useState(ALL);
  const [memberFilter, setMemberFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [labelFilter, setLabelFilter] = useState(ALL);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    if (!datesForTask(task)) return false;
    if (projectFilter !== ALL && task.project_id !== projectFilter) return false;
    if (statusFilter !== ALL && task.status !== statusFilter) return false;
    if (labelFilter !== ALL && !(task.labels ?? []).includes(labelFilter)) return false;
    if (memberFilter !== ALL) {
      const members = new Set([task.user_id, ...(task.card_members ?? []).map((member) => member.user_id)].filter(Boolean));
      if (memberFilter === "__unassigned__" ? members.size > 0 : !members.has(memberFilter)) return false;
    }
    if (task.archived_at) return false;
    if (overdueOnly && taskDeadlineState(task, dayKey(new Date())) !== "overdue") return false;
    return true;
  }), [tasks, projectFilter, statusFilter, labelFilter, memberFilter, overdueOnly]);

  const availableProjects = useMemo(() => {
    const names = new Map(projects.map((project) => [project.project_id, project.project_name]));
    return [...new Set(tasks.map((task) => task.project_id))].map((id) => ({ id, name: names.get(id) ?? `Project ${id.slice(0, 8)}` }));
  }, [projects, tasks]);
  const projectNames = useMemo(() => new Map(projects.map((project) => [project.project_id, project.project_name])), [projects]);
  const availableLabels = useMemo(() => {
    const saved = labels.map((label) => ({ key: label.label_key, name: label.name }));
    const directColors = [...new Set(tasks.flatMap((task) => task.labels ?? []).filter((key) => /^#[0-9a-f]{6}$/i.test(key)))].map((key) => ({ key, name: `Color ${key.toUpperCase()}` }));
    const known = new Set(saved.map((label) => label.key));
    return [...saved, ...directColors.filter((label) => !known.has(label.key))];
  }, [labels, tasks]);
  const availableMembers = useMemo(() => {
    const options = new Map<string, string>();
    for (const task of tasks) {
      if (task.user_id) options.set(task.user_id, task.assignee_name || "Assigned member");
      for (const member of task.card_members ?? []) options.set(member.user_id, member.name);
    }
    return [...options.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [tasks]);

  const calendarDates = useMemo(() => {
    if (view === "day") return [new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate())];
    if (view === "week") {
      const start = new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate() - viewDate.getDay());
      return Array.from({ length: 7 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
    }
    const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const gridStart = new Date(first.getFullYear(), first.getMonth(), first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, index) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index));
  }, [view, viewDate]);

  const periodLabel = view === "day"
    ? viewDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : view === "week"
      ? `${calendarDates[0]?.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${calendarDates[6]?.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
      : viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const movePeriod = (direction: number) => {
    if (view === "month") setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + direction, 1));
    else setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate() + direction * (view === "week" ? 7 : 1)));
  };

  const todayKey = dayKey(new Date());
  const selectedTask = tasks.find((task) => task.task_id === selectedTaskId) ?? null;
  const canEditDetails = permissionCodes.some((code) => ["kanban.cards.details.update", "tasks.update", "roles.manage"].includes(code)) || (!!selectedTask && selectedTask.user_id === currentUser?.user_id && permissionCodes.includes("tasks.update_assigned"));
  const clearFilters = () => { setProjectFilter(ALL); setMemberFilter(ALL); setStatusFilter(ALL); setLabelFilter(ALL); setOverdueOnly(false); };

  if (!canReadTasks) return <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">You need task or Kanban view permission to see scheduled cards.</div>;

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2"><div className="flex items-center gap-1"><Button variant="outline" size="icon" aria-label="Previous period" onClick={() => movePeriod(-1)}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" aria-label="Next period" onClick={() => movePeriod(1)}><ChevronRight className="h-4 w-4" /></Button></div><h2 className="min-w-[190px] text-lg font-semibold">{periodLabel}</h2><Button variant="outline" size="sm" onClick={() => setViewDate(new Date())}>Today</Button></div>
      <div className="inline-flex rounded-lg border p-1" role="group" aria-label="Calendar view">{(["month", "week", "day"] as const).map((option) => <Button key={option} size="sm" variant={view === option ? "default" : "ghost"} onClick={() => setView(option)} className="capitalize">{option}</Button>)}</div>
    </div>

    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
      <Select value={projectFilter} onValueChange={setProjectFilter}><SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Project" /></SelectTrigger><SelectContent><SelectItem value={ALL}>All projects</SelectItem>{availableProjects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select>
      <Select value={memberFilter} onValueChange={setMemberFilter}><SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Member" /></SelectTrigger><SelectContent><SelectItem value={ALL}>All members</SelectItem><SelectItem value="__unassigned__">Unassigned</SelectItem>{availableMembers.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent></Select>
      <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value={ALL}>All statuses</SelectItem>{STATUSES.map((status) => <SelectItem key={status} value={status}>{status.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select>
      <Select value={labelFilter} onValueChange={setLabelFilter}><SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Label" /></SelectTrigger><SelectContent><SelectItem value={ALL}>All labels</SelectItem>{availableLabels.map((label) => <SelectItem key={label.key} value={label.key}>{label.name}</SelectItem>)}</SelectContent></Select>
      <label className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm"><input type="checkbox" checked={overdueOnly} onChange={(event) => setOverdueOnly(event.target.checked)} />Overdue</label>
      <Button variant="ghost" size="sm" onClick={clearFilters}><FilterX className="mr-1 h-4 w-4" />Clear</Button>
      <span className="ml-auto text-xs text-muted-foreground">{filteredTasks.length} scheduled {filteredTasks.length === 1 ? "card" : "cards"}</span>
    </div>

    {isLoading ? <div className="rounded-xl border p-10 text-center text-sm text-muted-foreground">Loading scheduled cards…</div> : isError ? <div role="alert" className="rounded-xl border border-destructive/30 p-6 text-sm text-destructive">Could not load tasks: {error instanceof Error ? error.message : "Please try again."}</div> : <div className="overflow-x-auto rounded-xl border"><div className={`grid min-w-[700px] ${view === "day" ? "grid-cols-1" : "grid-cols-7"}`}>
      {(view !== "day" ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : [periodLabel]).map((label) => <div key={label} className="border-b bg-muted/40 px-2 py-2 text-xs font-semibold text-muted-foreground">{label}</div>)}
      {calendarDates.map((date) => {
        const key = dayKey(date);
        const dayTasks = filteredTasks.filter((task) => coversDate(task, key)).sort((a, b) => (a.due_date ?? a.start_date ?? "").localeCompare(b.due_date ?? b.start_date ?? ""));
        const conflictCount = dayTasks.filter((task) => task.status !== "DONE" && task.status !== "CANCELLED").length;
        const inVisibleMonth = date.getMonth() === viewDate.getMonth();
        return <section key={key} aria-label={`${date.toLocaleDateString()}, ${dayTasks.length} scheduled cards`} className={`min-h-32 border-b border-r p-1.5 ${inVisibleMonth || view !== "month" ? "bg-background" : "bg-muted/20"} ${key === todayKey ? "ring-2 ring-inset ring-primary/40" : ""}`}>
          <div className="mb-1 flex items-center justify-between gap-1"><span className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs ${key === todayKey ? "bg-primary font-semibold text-primary-foreground" : "text-foreground"}`}>{view === "month" ? date.getDate() : date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>{conflictCount > 1 && <span title={`${conflictCount} active cards overlap this day`} className="rounded bg-orange-100 px-1.5 py-0.5 text-[9px] font-medium text-orange-800">{conflictCount} overlap</span>}</div>
          <div className="space-y-1">{dayTasks.slice(0, view === "day" ? 100 : 3).map((task) => {
            const deadlineState = taskDeadlineState(task, todayKey);
            const spans = datesForTask(task)!;
            const startHere = spans.start === key;
            const endHere = spans.end === key;
            const taskLabelKeys = task.labels ?? [];
            const directColor = taskLabelKeys.find((labelKey) => /^#[0-9a-f]{6}$/i.test(labelKey));
            const labelChips = taskLabelKeys.filter((labelKey) => !/^#[0-9a-f]{6}$/i.test(labelKey)).slice(0, 2).map((labelKey) => labels.find((label) => label.label_key === labelKey) ?? { label_key: labelKey, name: labelKey, color: "#64748B" });
            const taskColor = directColor ?? labelChips[0]?.color;
            return <button key={task.task_id} type="button" onClick={() => setSelectedTaskId(task.task_id)} title={`${task.task_name} · ${projectNames.get(task.project_id) ?? "Project"} · ${task.status.replaceAll("_", " ")}${task.assignee_name ? ` · ${task.assignee_name}` : ""}`} style={taskColor ? { backgroundColor: taskColor, color: labelTextColor(taskColor), borderLeftColor: deadlineState === "overdue" ? "#dc2626" : deadlineState === "soon" ? "#f97316" : taskColor } : undefined} className={`block w-full min-w-0 rounded border-l-4 px-1.5 py-1 text-left text-[11px] shadow-sm transition hover:shadow ${STATUS_STYLE[task.status] ?? STATUS_STYLE.TODO} ${deadlineState === "overdue" ? "ring-1 ring-inset ring-red-500" : ""} ${spans.start < key ? "rounded-l-none" : ""} ${spans.end > key ? "rounded-r-none" : ""}`}>
              <span className="block truncate font-semibold">{task.task_name}</span>
              <span className="block truncate text-[10px] opacity-80">{projectNames.get(task.project_id) ?? "Project"}{startHere && task.start_date ? ` · Starts ${task.start_date}` : ""}{endHere && task.due_date ? ` · Due ${task.due_date}` : ""}</span>
              {(task.assignee_name || task.card_members?.length) && <span className="block truncate text-[10px] opacity-80">{task.assignee_name || task.card_members?.map((member) => member.name).join(", ")}</span>}
              {!!labelChips.filter(Boolean).length && <span className="mt-0.5 flex gap-1">{labelChips.filter(Boolean).map((label) => <span key={label!.label_key} className="max-w-20 truncate rounded px-1 text-[9px]" style={{ backgroundColor: `${label!.color}55`, color: labelTextColor(label!.color) }}>{label!.name}</span>)}</span>}
              {deadlineState === "overdue" && <span className="text-[9px] font-bold uppercase">Overdue</span>}{deadlineState === "soon" && <span className="text-[9px] font-bold uppercase">Due soon</span>}
            </button>;
      })}{dayTasks.length > (view === "day" ? 100 : 3) && <p className="px-1 text-[10px] text-muted-foreground">+{dayTasks.length - (view === "day" ? 100 : 3)} more cards</p>}</div>
        </section>;
      })}
    </div></div>}

    <KanbanCardDetailsDialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTaskId(null)} task={selectedTask} canEdit={canEditDetails} canViewComments={permissionCodes.some((code) => ["tasks.comments.view", "tasks.comments.create", "tasks.manage", "roles.manage"].includes(code))} canPostComments={permissionCodes.some((code) => ["tasks.comments.create", "tasks.manage", "roles.manage"].includes(code))} canViewAttachments={permissionCodes.some((code) => ["kanban.card_attachments.view", "kanban.card_attachments.upload", "kanban.card_attachments.delete", "tasks.update", "tasks.update_assigned", "roles.manage"].includes(code))} canUploadAttachments={permissionCodes.some((code) => ["kanban.card_attachments.upload", "tasks.update", "tasks.update_assigned", "roles.manage"].includes(code))} canDeleteAttachments={permissionCodes.some((code) => ["kanban.card_attachments.delete", "tasks.update", "tasks.update_assigned", "roles.manage"].includes(code))} />
  </div>;
}
