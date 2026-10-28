"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, CheckSquare, Search, MoveDown, MoveUp } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { TaskStatusBadge } from "@/components/shared/status-badge";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { TaskFormDialog } from "@/components/modules/tasks/task-form-dialog";
import { TaskDependencyPanel } from "@/components/modules/tasks/task-dependency-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useBulkUpdateTasks, useDeleteTask, useMoveBacklogTask, useTasks } from "@/hooks/queries/use-tasks";
import { useProjectComponents, useProjectReleases, useProjects } from "@/hooks/queries/use-projects";
import { useUsers } from "@/hooks/queries/use-users";
import { isDeveloperOrTester } from "@/lib/member-visibility";
import { useAuthStore } from "@/store/auth-store";
import { formatDate } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/api/client";
import { TASK_PRIORITIES, TASK_STATUSES, TASK_STATUS_LABEL, PRIORITY_LABEL, type TaskStatus } from "@/lib/constants";
import type { Task } from "@/types/task";
import { usePermissions } from "@/hooks/use-permissions";
import { canUpdateTask } from "@/lib/permissions";

const ALL = "__all__";
const BULK_ASSIGNEE_UNCHANGED = "__unchanged__";
const BULK_ASSIGNEE_UNASSIGNED = "__unassigned__";
const isOverdueTask = (task: Task) => {
  if (!task.due_date || task.status === "DONE" || task.status === "CANCELLED") return false;
  const dueDate = new Date(`${task.due_date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dueDate < today;
};

// tasks has no `progress` column in the backend — this is a frontend-only
// approximation from status, purely for the visual progress bar.
const STATUS_PROGRESS: Record<TaskStatus, number> = {
  TODO: 0,
  IN_PROGRESS: 50,
  IN_REVIEW: 75,
  DONE: 100,
  BLOCKED: 25,
  CANCELLED: 0,
};

export default function TasksPage() {
  const { data: allTasks, isLoading } = useTasks({ limit: 500 });
  const { data: projects } = useProjects();
  const { data: users } = useUsers();
  const deleteMutation = useDeleteTask();
  const moveBacklogTask = useMoveBacklogTask();
  const bulkUpdateTasks = useBulkUpdateTasks();
  const currentUser = useAuthStore((s) => s.user);
  const { canManageTasks, permissionCodes } = usePermissions();

  const [tab, setTab] = useState<"all" | "mine" | "overdue" | "backlog" | "blocked">("all");
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState(ALL);
  const [componentFilter, setComponentFilter] = useState(ALL);
  const [releaseFilter, setReleaseFilter] = useState(ALL);
  const [labelFilter, setLabelFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [priorityFilter, setPriorityFilter] = useState(ALL);
  const [dueFilter, setDueFilter] = useState<"ALL" | "OVERDUE">("ALL");

  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(() => new Set());
  const [bulkPriority, setBulkPriority] = useState<(typeof TASK_PRIORITIES)[number]>("HIGH");
  const [bulkDueDate, setBulkDueDate] = useState("");
  const [bulkAssigneeId, setBulkAssigneeId] = useState(BULK_ASSIGNEE_UNCHANGED);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "blocked") setTab("blocked");
  }, []);

  const projectMap = useMemo(() => new Map((projects ?? []).map((p) => [p.project_id, p])), [projects]);
  const userMap = useMemo(() => new Map((users ?? []).map((u) => [u.user_id, u])), [users]);
  const { data: projectComponents = [] } = useProjectComponents(projectFilter !== ALL ? projectFilter : undefined);
  const { data: projectReleases = [] } = useProjectReleases(projectFilter !== ALL ? projectFilter : undefined);

  const filtersActive = !!search.trim() || projectFilter !== ALL || componentFilter !== ALL || releaseFilter !== ALL || !!labelFilter.trim() || assigneeFilter !== ALL || statusFilter !== ALL || priorityFilter !== ALL || dueFilter !== "ALL" || tab !== "all";
  const { data: serverFilteredTasks, isLoading: filtersLoading } = useTasks({
    limit: 500,
    search: search.trim() || undefined,
    project_id: projectFilter !== ALL ? projectFilter : undefined,
    component_id: componentFilter !== ALL ? componentFilter : undefined,
    release_id: releaseFilter !== ALL ? releaseFilter : undefined,
    label: labelFilter.trim() || undefined,
    status: statusFilter !== ALL ? statusFilter : tab === "backlog" ? "TODO" : undefined,
    priority: priorityFilter !== ALL ? priorityFilter : undefined,
    assignee_id: assigneeFilter !== ALL ? assigneeFilter : tab === "mine" ? currentUser?.user_id : undefined,
    overdue: tab === "overdue" || dueFilter === "OVERDUE" ? true : undefined,
    backlog: tab === "backlog" ? true : undefined,
    blocked: tab === "blocked" ? true : undefined,
  }, filtersActive);
  const tasks = filtersActive ? serverFilteredTasks : allTasks;
  const isResultsLoading = filtersActive ? filtersLoading : isLoading;
  useEffect(() => {
    const visibleTaskIds = new Set((tasks ?? []).map((task) => task.task_id));
    setSelectedTaskIds((selected) => {
      const next = new Set([...selected].filter((taskId) => visibleTaskIds.has(taskId)));
      return next.size === selected.size ? selected : next;
    });
  }, [tasks]);
  useEffect(() => {
    if (selectedTaskIds.size === 0) setBulkAssigneeId(BULK_ASSIGNEE_UNCHANGED);
  }, [selectedTaskIds.size]);
  const allVisibleTasksSelected = !!tasks?.length && tasks.length <= 100 && tasks.every((task) => selectedTaskIds.has(task.task_id));
  const someVisibleTasksSelected = !!tasks?.some((task) => selectedTaskIds.has(task.task_id));
  const selectedTasks = (tasks ?? []).filter((task) => selectedTaskIds.has(task.task_id));
  const canBulkUnassign = selectedTasks.length > 0 && selectedTasks.every((task) => !task.team_id);
  const total = allTasks?.length ?? 0;
  const completed = allTasks?.filter((t) => t.status === "DONE").length ?? 0;
  const inProgress = allTasks?.filter((t) => t.status === "IN_PROGRESS").length ?? 0;
  const todo = allTasks?.filter((t) => t.status === "TODO").length ?? 0;
  const overdue = allTasks?.filter(isOverdueTask).length ?? 0;
  const blocked = allTasks?.filter((t) => t.status === "BLOCKED").length ?? 0;

  const showTaskResults = (status: string, taskTab: "all" | "mine" | "overdue" = "all") => {
    setSearch("");
    setProjectFilter(ALL);
    setComponentFilter(ALL);
    setReleaseFilter(ALL);
    setLabelFilter("");
    setAssigneeFilter(ALL);
    setPriorityFilter(ALL);
    setDueFilter("ALL");
    setStatusFilter(status);
    setTab(taskTab);
    requestAnimationFrame(() => document.getElementById("task-results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const applyBulkPriority = async () => {
    try {
      const result = await bulkUpdateTasks.mutateAsync({ taskIds: [...selectedTaskIds], priority: bulkPriority });
      setSelectedTaskIds(new Set());
      toast.success(result.updated_count ? `Priority updated for ${result.updated_count} tasks` : "Selected tasks already have this priority");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };
  const applyBulkDueDate = async (dueDate: string | null) => {
    try {
      const result = await bulkUpdateTasks.mutateAsync({ taskIds: [...selectedTaskIds], dueDate });
      setSelectedTaskIds(new Set());
      toast.success(result.updated_count ? `Due date updated for ${result.updated_count} tasks` : "Selected tasks already have this due date");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };
  const applyBulkAssignee = async () => {
    if (bulkAssigneeId === BULK_ASSIGNEE_UNCHANGED) return;
    try {
      const assigneeId = bulkAssigneeId === BULK_ASSIGNEE_UNASSIGNED ? null : bulkAssigneeId;
      const result = await bulkUpdateTasks.mutateAsync({ taskIds: [...selectedTaskIds], assigneeId });
      setSelectedTaskIds(new Set());
      setBulkAssigneeId(BULK_ASSIGNEE_UNCHANGED);
      toast.success(result.updated_count ? `Assignee updated for ${result.updated_count} tasks` : "Selected tasks already have this assignee");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  const openCreate = () => {
    setEditingTask(null);
    setFormOpen(true);
  };
  const openEdit = (task: Task) => {
    setEditingTask(task);
    setFormOpen(true);
  };
  const confirmDelete = async () => {
    if (!deletingTask) return;
    try {
      await deleteMutation.mutateAsync(deletingTask.task_id);
      toast.success("Task deleted");
      setDeletingTask(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Manage and track all tasks across your projects"
        showHome={false}
        actions={canManageTasks ? (
          <Button onClick={openCreate}><Plus className="h-4 w-4" />New Task</Button>
        ) : undefined}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <button type="button" onClick={() => showTaskResults(ALL)} className="metric-card rounded-2xl border border-border bg-card text-left transition hover:border-violet-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
          <div className="p-4">
            <p className="text-xs text-muted-foreground">Total Tasks</p>
            <p className="mt-1 text-2xl font-semibold">{total}</p>
          </div>
        </button>
        <button type="button" onClick={() => showTaskResults("DONE")} className="metric-card rounded-2xl border border-border bg-card text-left transition hover:border-violet-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
          <div className="p-4">
            <p className="text-xs text-muted-foreground">Completed</p>
            <p className="mt-1 text-2xl font-semibold text-green-600">{completed}</p>
          </div>
        </button>
        <button type="button" onClick={() => showTaskResults("IN_PROGRESS")} className="metric-card rounded-2xl border border-border bg-card text-left transition hover:border-violet-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
          <div className="p-4">
            <p className="text-xs text-muted-foreground">In Progress</p>
            <p className="mt-1 text-2xl font-semibold text-blue-600">{inProgress}</p>
          </div>
        </button>
        <button type="button" onClick={() => showTaskResults("TODO")} className="metric-card rounded-2xl border border-border bg-card text-left transition hover:border-violet-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
          <div className="p-4">
            <p className="text-xs text-muted-foreground">To Do</p>
            <p className="mt-1 text-2xl font-semibold text-slate-600">{todo}</p>
          </div>
        </button>
        <button type="button" onClick={() => showTaskResults(ALL, "overdue")} className="metric-card rounded-2xl border border-border bg-card text-left transition hover:border-violet-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
          <div className="p-4">
            <p className="text-xs text-muted-foreground">Overdue</p>
            <p className="mt-1 text-2xl font-semibold text-red-600">{overdue}</p>
          </div>
        </button>
        <button type="button" onClick={() => showTaskResults("BLOCKED")} className="metric-card rounded-2xl border border-border bg-card text-left transition hover:border-violet-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
          <div className="p-4">
            <p className="text-xs text-muted-foreground">Blocked</p>
            <p className="mt-1 text-2xl font-semibold text-red-500">{blocked}</p>
          </div>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Input className="w-full max-w-44" placeholder="Filter by label" aria-label="Filter tasks by label" value={labelFilter} onChange={(event) => setLabelFilter(event.target.value)} />

        <Select value={projectFilter} onValueChange={(value) => { setProjectFilter(value); setComponentFilter(ALL); setReleaseFilter(ALL); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Projects</SelectItem>
            {(projects ?? []).map((p) => (
              <SelectItem key={p.project_id} value={p.project_id}>
                {p.project_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {projectFilter !== ALL && <Select value={componentFilter} onValueChange={setComponentFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Component" /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>All components</SelectItem>{projectComponents.map((component) => <SelectItem key={component.component_id} value={component.component_id}>{component.name}</SelectItem>)}</SelectContent>
        </Select>}
        {projectFilter !== ALL && <Select value={releaseFilter} onValueChange={setReleaseFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Release" /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>All releases</SelectItem>{projectReleases.map((release) => <SelectItem key={release.release_id} value={release.release_id}>{release.name}{release.version ? ` · ${release.version}` : ""}</SelectItem>)}</SelectContent>
        </Select>}

        <Select value={assigneeFilter} onValueChange={(value) => { setAssigneeFilter(value); setTab("all"); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Assignee" /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>All assignees</SelectItem>{(users ?? []).map((person) => <SelectItem key={person.user_id} value={person.user_id}>{person.name}</SelectItem>)}</SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Statuses</SelectItem>
            {TASK_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {TASK_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Priorities</SelectItem>
            {TASK_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={dueFilter} onValueChange={(value) => setDueFilter(value as typeof dueFilter)}>
          <SelectTrigger className="w-36" aria-label="Filter tasks by due date">
            <SelectValue placeholder="Due date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All due dates</SelectItem>
            <SelectItem value="OVERDUE">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v as typeof tab); setAssigneeFilter(ALL); }}>
        <TabsList>
          <TabsTrigger value="all">List View</TabsTrigger>
          <TabsTrigger value="backlog">Backlog</TabsTrigger>
          <TabsTrigger value="mine">My Tasks</TabsTrigger>
          <TabsTrigger value="overdue">Overdue Tasks</TabsTrigger>
          <TabsTrigger value="blocked">Blocked work</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "blocked" && <TaskDependencyPanel projects={projects ?? []} users={users ?? []} />}

      {canManageTasks && selectedTaskIds.size > 0 && <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
        <span className="mr-auto text-sm font-medium">{selectedTaskIds.size} selected</span>
        <Select value={bulkAssigneeId} onValueChange={setBulkAssigneeId}>
          <SelectTrigger className="w-44" aria-label="Assignee for selected tasks"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={BULK_ASSIGNEE_UNCHANGED}>Choose assignee</SelectItem>
            {canBulkUnassign && <SelectItem value={BULK_ASSIGNEE_UNASSIGNED}>Unassigned</SelectItem>}
            {(users ?? []).filter((person) => person.is_active).map((person) => <SelectItem key={person.user_id} value={person.user_id}>{person.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={() => void applyBulkAssignee()} disabled={bulkUpdateTasks.isPending || bulkAssigneeId === BULK_ASSIGNEE_UNCHANGED}>
          {bulkUpdateTasks.isPending ? "Updating…" : "Apply assignee"}
        </Button>
        <Select value={bulkPriority} onValueChange={(value) => setBulkPriority(value as typeof bulkPriority)}>
          <SelectTrigger className="w-40" aria-label="Priority for selected tasks"><SelectValue /></SelectTrigger>
          <SelectContent>{TASK_PRIORITIES.map((priority) => <SelectItem key={priority} value={priority}>{PRIORITY_LABEL[priority]}</SelectItem>)}</SelectContent>
        </Select>
        <Button size="sm" onClick={() => void applyBulkPriority()} disabled={bulkUpdateTasks.isPending}>
          {bulkUpdateTasks.isPending ? "Updating…" : "Apply priority"}
        </Button>
        <Input type="date" className="w-40" aria-label="Due date for selected tasks" value={bulkDueDate} onChange={(event) => setBulkDueDate(event.target.value)} />
        <Button size="sm" variant="outline" onClick={() => void applyBulkDueDate(bulkDueDate)} disabled={bulkUpdateTasks.isPending || !bulkDueDate}>
          Apply due date
        </Button>
        <Button size="sm" variant="outline" onClick={() => void applyBulkDueDate(null)} disabled={bulkUpdateTasks.isPending}>
          Clear due dates
        </Button>
        <Button size="sm" variant="outline" onClick={() => { setSelectedTaskIds(new Set()); setBulkAssigneeId(BULK_ASSIGNEE_UNCHANGED); }} disabled={bulkUpdateTasks.isPending}>Clear selection</Button>
      </div>}

      <Card id="task-results" className="scroll-mt-6">
        {isResultsLoading ? (
          <CardContent className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </CardContent>
        ) : (tasks ?? []).length === 0 ? (
          <CardContent className="p-5">
            <EmptyState
              icon={CheckSquare}
              title="No tasks found"
              description={canManageTasks ? "Try adjusting your filters, or create a new task." : "No tasks are available to view with your current filters."}
              actionLabel={canManageTasks ? "New Task" : undefined}
              onAction={canManageTasks ? openCreate : undefined}
            />
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {canManageTasks && <TableHead className="w-10"><Checkbox aria-label="Select all visible tasks" checked={allVisibleTasksSelected ? true : someVisibleTasksSelected ? "indeterminate" : false} disabled={!tasks?.length || tasks.length > 100} title={tasks && tasks.length > 100 ? "Select individual tasks (up to 100 per update)" : undefined} onCheckedChange={(checked) => setSelectedTaskIds(checked === true ? new Set((tasks ?? []).map((task) => task.task_id)) : new Set())} /></TableHead>}
                <TableHead>Task</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(tasks ?? []).map((task, taskIndex) => {
                const project = projectMap.get(task.project_id);
                const candidateAssignee = task.user_id ? userMap.get(task.user_id) : null;
                const assignee = candidateAssignee && isDeveloperOrTester(candidateAssignee)
                  ? candidateAssignee
                  : task.user_id && task.assignee_name
                    ? { user_id: task.user_id, name: task.assignee_name }
                    : null;
                const isOverdue = isOverdueTask(task);
                const canEdit = !!currentUser && canUpdateTask(task.user_id, currentUser.user_id, permissionCodes);
                const canDelete = canManageTasks;

                return (
                  <TableRow key={task.task_id}>
                    {canManageTasks && <TableCell><Checkbox aria-label={`Select ${task.task_name}`} checked={selectedTaskIds.has(task.task_id)} disabled={!selectedTaskIds.has(task.task_id) && selectedTaskIds.size >= 100} onCheckedChange={(checked) => setSelectedTaskIds((selected) => { const next = new Set(selected); if (checked === true) next.add(task.task_id); else next.delete(task.task_id); return next; })} /></TableCell>}
                    <TableCell>
                      <p className="font-medium text-foreground">{task.task_name}</p>
                      {!!task.labels?.length && <div className="mt-1 flex flex-wrap gap-1">{task.labels.map((label) => <span key={label} className="rounded-full border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{label}</span>)}</div>}
                      {task.description && (
                        <p className="line-clamp-1 max-w-xs text-xs text-muted-foreground">{task.description}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {project ? <><span className="mr-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{project.project_key}</span>{project.project_name}</> : "—"}
                    </TableCell>
                    <TableCell>
                      <UserAvatar user={assignee} />
                    </TableCell>
                    <TableCell>
                      <TaskStatusBadge status={task.status} />
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={task.priority} />
                    </TableCell>
                    <TableCell className={`text-sm ${isOverdue ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                      {formatDate(task.due_date)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={STATUS_PROGRESS[task.status]} className="h-1.5 w-16" />
                        <span className="text-xs text-muted-foreground">{STATUS_PROGRESS[task.status]}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {(canEdit || canDelete) && (
                      <div className="flex flex-nowrap items-center gap-1">
                        {tab === "backlog" && canManageTasks && <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Move ${task.task_name} up`} disabled={taskIndex === 0 || moveBacklogTask.isPending} onClick={() => moveBacklogTask.mutate({ taskId: task.task_id, direction: "UP" }, { onError: (error) => toast.error(getApiErrorMessage(error)) })}><MoveUp className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Move ${task.task_name} down`} disabled={taskIndex === (tasks?.length ?? 0) - 1 || moveBacklogTask.isPending} onClick={() => moveBacklogTask.mutate({ taskId: task.task_id, direction: "DOWN" }, { onError: (error) => toast.error(getApiErrorMessage(error)) })}><MoveDown className="h-4 w-4" /></Button>
                        </>}
                        {canEdit && <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Edit task" title="Edit task" onClick={() => openEdit(task)}><Pencil className="h-4 w-4" /></Button>}
                        {canDelete && <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" aria-label="Delete task" title="Delete task" onClick={() => setDeletingTask(task)}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <TaskFormDialog open={formOpen} onOpenChange={setFormOpen} task={editingTask} />

      <ConfirmDialog
        open={!!deletingTask}
        onOpenChange={(open) => !open && setDeletingTask(null)}
        title="Delete task?"
        description={`This will permanently delete "${deletingTask?.task_name}"${
          deletingTask ? " and any of its subtasks" : ""
        }. This action cannot be undone.`}
        onConfirm={confirmDelete}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
