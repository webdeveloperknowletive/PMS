"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, CheckSquare, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { TaskStatusBadge } from "@/components/shared/status-badge";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { TaskFormDialog } from "@/components/modules/tasks/task-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDeleteTask, useTasks } from "@/hooks/queries/use-tasks";
import { useProjects } from "@/hooks/queries/use-projects";
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
  const { data: tasks, isLoading } = useTasks({ limit: 500 });
  const { data: projects } = useProjects();
  const { data: users } = useUsers();
  const deleteMutation = useDeleteTask();
  const currentUser = useAuthStore((s) => s.user);
  const { canManageTasks, permissionCodes } = usePermissions();

  const [tab, setTab] = useState<"all" | "mine" | "overdue">("all");
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [priorityFilter, setPriorityFilter] = useState(ALL);

  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);

  const projectMap = useMemo(() => new Map((projects ?? []).map((p) => [p.project_id, p])), [projects]);
  const userMap = useMemo(() => new Map((users ?? []).map((u) => [u.user_id, u])), [users]);

  const filtered = (tasks ?? []).filter((t) => {
    if (search && !t.task_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (projectFilter !== ALL && t.project_id !== projectFilter) return false;
    if (statusFilter !== ALL && t.status !== statusFilter) return false;
    if (priorityFilter !== ALL && t.priority !== priorityFilter) return false;
    if (tab === "mine" && t.user_id !== currentUser?.user_id) return false;
    if (tab === "overdue" && !(t.due_date && new Date(t.due_date) < new Date() && t.status !== "DONE")) return false;
    return true;
  });
  const total = tasks?.length ?? 0;
  const completed = tasks?.filter((t) => t.status === "DONE").length ?? 0;
  const inProgress = tasks?.filter((t) => t.status === "IN_PROGRESS").length ?? 0;
  const todo = tasks?.filter((t) => t.status === "TODO").length ?? 0;
  const overdue =
    tasks?.filter((t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== "DONE").length ?? 0;
  const blocked = tasks?.filter((t) => t.status === "BLOCKED").length ?? 0;

  const showTaskResults = (status: string, taskTab: "all" | "mine" | "overdue" = "all") => {
    setSearch("");
    setProjectFilter(ALL);
    setPriorityFilter(ALL);
    setStatusFilter(status);
    setTab(taskTab);
    requestAnimationFrame(() => document.getElementById("task-results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
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
        actions={canManageTasks ? (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New Task
          </Button>
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

        <Select value={projectFilter} onValueChange={setProjectFilter}>
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
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="all">List View</TabsTrigger>
          <TabsTrigger value="mine">My Tasks</TabsTrigger>
          <TabsTrigger value="overdue">Overdue Tasks</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card id="task-results" className="scroll-mt-6">
        {isLoading ? (
          <CardContent className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </CardContent>
        ) : filtered.length === 0 ? (
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
              {filtered.map((task) => {
                const project = projectMap.get(task.project_id);
                const candidateAssignee = task.user_id ? userMap.get(task.user_id) : null;
                const assignee = candidateAssignee && isDeveloperOrTester(candidateAssignee)
                  ? candidateAssignee
                  : task.user_id && task.assignee_name
                    ? { user_id: task.user_id, name: task.assignee_name }
                    : null;
                const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "DONE";
                const canEdit = !!currentUser && canUpdateTask(task.user_id, currentUser.user_id, permissionCodes);
                const canDelete = canManageTasks;

                return (
                  <TableRow key={task.task_id}>
                    <TableCell>
                      <p className="font-medium text-foreground">{task.task_name}</p>
                      {task.description && (
                        <p className="line-clamp-1 max-w-xs text-xs text-muted-foreground">{task.description}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {project?.project_name ?? "—"}
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
