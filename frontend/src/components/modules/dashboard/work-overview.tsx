"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, ClipboardCheck, Clock3, ListTodo, MessageCircle, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskStatusBadge } from "@/components/shared/status-badge";
import { useTasks, useTaskWorkTimes, useWorkSessions } from "@/hooks/queries/use-tasks";
import { useProjects } from "@/hooks/queries/use-projects";
import { useApproveKanbanReview, useKanbanColumns, useKanbanTaskPlacements } from "@/hooks/queries/use-kanban";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuthStore } from "@/store/auth-store";
import { formatDate } from "@/lib/utils";
import { getTaskWorkflowStatus } from "@/lib/kanban-status";
import { TaskFormDialog } from "@/components/modules/tasks/task-form-dialog";
import { TaskActivityDialog } from "@/components/modules/tasks/task-activity-dialog";
import { canUpdateTask } from "@/lib/permissions";
import { isDeveloperOrTester } from "@/lib/member-visibility";
import { getApiErrorMessage } from "@/lib/api/client";
import { useUsers } from "@/hooks/queries/use-users";
import { useTeamMemberCandidates } from "@/hooks/queries/use-teams";
import { toast } from "sonner";
import type { Task } from "@/types/task";

export function WorkOverview() {
  const user = useAuthStore((state) => state.user);
  const { canManageTasks, canMoveKanbanCard, permissionCodes } = usePermissions();
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [commentTask, setCommentTask] = useState<Task | null>(null);
  const [approvingTaskId, setApprovingTaskId] = useState<string | null>(null);
  const isTeamLead = (user?.role_names ?? []).some((role) => role.trim().toLowerCase() === "team lead");
  const { data: tasks = [], isLoading } = useTasks({ limit: 500 }, permissionCodes.includes("tasks.view"));
  const canViewAssignedProjects = ["projects.view", "projects.create", "projects.update", "projects.delete", "tasks.view", "tasks.create", "tasks.update", "tasks.delete", "teams.view", "teams.create", "teams.update", "teams.delete"].some((code) => permissionCodes.includes(code));
  const { data: projects = [] } = useProjects(undefined, canViewAssignedProjects);
  const { data: employees = [] } = useUsers(undefined, permissionCodes.includes("users.view"));
  const canViewTeamMembers = ["teams.view", "teams.manage", "teams.members.view", "teams.members.manage", "teams.leads.view"].some((code) => permissionCodes.includes(code));
  const { data: teamMemberCandidates = [] } = useTeamMemberCandidates(canViewTeamMembers);
  const { data: kanbanColumns = [] } = useKanbanColumns(isTeamLead);
  const { data: kanbanPlacements = [] } = useKanbanTaskPlacements(isTeamLead);
  const approveKanbanReview = useApproveKanbanReview();
  const { data: sessions = [] } = useWorkSessions(permissionCodes.includes("tasks.work_sessions.view"));
  const { data: taskWorkTimes = [] } = useTaskWorkTimes(permissionCodes.includes("tasks.work_time.view"));
  const taskTimeMap = useMemo(() => new Map(taskWorkTimes.map((item) => [item.task_id, item])), [taskWorkTimes]);
  const hasRunningTask = taskWorkTimes.some((item) => item.is_tracking);
  const [clockNow, setClockNow] = useState(Date.now());
  useEffect(() => {
    if (!hasRunningTask) return;
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasRunningTask]);
  const myTasks = tasks.filter((task) => task.user_id === user?.user_id);
  const canViewTeamTasks = ["tasks.create", "tasks.update", "tasks.delete", "projects.create", "projects.update", "projects.delete"].some((code) => permissionCodes.includes(code));
  const displayedTasks = canViewTeamTasks ? tasks : myTasks;
  // Keep the overview metrics in the same scope and workflow state as its task list.
  const overviewTasks = isTeamLead && canViewTeamTasks ? displayedTasks : myTasks;
  const overviewStatus = (task: Task) => getTaskWorkflowStatus(task, kanbanPlacements, kanbanColumns);
  const completed = overviewTasks.filter((task) => overviewStatus(task) === "DONE").length;
  const overdue = overviewTasks.filter((task) => task.due_date && task.due_date < new Date().toISOString().slice(0, 10) && !["DONE", "CANCELLED"].includes(overviewStatus(task))).length;
  const projectNames = new Map(projects.map((project) => [project.project_id, project.project_name]));
  const visibleEmployeeIds = new Set([
    ...employees.filter(isDeveloperOrTester).map((employee) => employee.user_id),
    ...teamMemberCandidates.map((member) => member.user_id),
  ]);
  const employeeNameById = new Map([
    ...teamMemberCandidates.map((member) => [member.user_id, member.name] as const),
    ...employees.map((employee) => [employee.user_id, employee.name] as const),
  ]);
  const canViewWorkspaceSessions = ["projects.create", "projects.update", "projects.delete", "tasks.view"].some((code) => permissionCodes.includes(code));
  const visibleSessions = sessions.filter((session) => canViewWorkspaceSessions || session.user_id === user?.user_id);
  const isAwaitingReview = (task: Task) => getTaskWorkflowStatus(task, kanbanPlacements, kanbanColumns) === "IN_REVIEW" || kanbanPlacements.some((placement) => {
    if (placement.task_id !== task.task_id) return false;
    const column = kanbanColumns.find((item) => item.column_id === placement.column_id);
    return !!column && ["in review", "in-review", "review"].includes(column.column_name.trim().toLowerCase());
  });

  const approveReview = async (task: Task) => {
    if (!task.team_id || !isAwaitingReview(task) || !canMoveKanbanCard) return;

    setApprovingTaskId(task.task_id);
    try {
      await approveKanbanReview.mutateAsync(task.task_id);
      toast.success("Review approved; the task moved to Done and the developer was notified.");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setApprovingTaskId(null);
    }
  };

  return <Card className="min-w-0 overflow-hidden border-white/90">
    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
      <div><CardTitle className="text-base font-bold text-violet-800">{canViewTeamTasks ? "Team work overview" : "My work overview"}</CardTitle><p className="mt-1 text-xs text-slate-500">See available work, due dates, completed work, and tracked time.</p></div>
      <Button asChild size="sm" variant="outline"><Link href="/tasks">Open tasks <ArrowRight className="h-3.5 w-3.5" /></Link></Button>
    </CardHeader>
    <CardContent className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Link href={isTeamLead ? "/kanban?view=self" : "/tasks"} className="rounded-xl bg-sky-50 p-3 transition hover:ring-2 hover:ring-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"><p className="flex items-center gap-1.5 text-xs font-semibold text-sky-800"><ListTodo className="h-3.5 w-3.5" />Assigned to me</p><p className="mt-1 text-xl font-bold text-sky-900">{myTasks.length}</p></Link>
        <Link href="/tasks" className="rounded-xl bg-emerald-50 p-3 transition hover:ring-2 hover:ring-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"><p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800"><CheckCircle2 className="h-3.5 w-3.5" />Completed</p><p className="mt-1 text-xl font-bold text-emerald-900">{completed}</p></Link>
        <Link href="/tasks" className="rounded-xl bg-rose-50 p-3 transition hover:ring-2 hover:ring-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"><p className="flex items-center gap-1.5 text-xs font-semibold text-rose-800"><Clock3 className="h-3.5 w-3.5" />Overdue</p><p className="mt-1 text-xl font-bold text-rose-900">{overdue}</p></Link>
        <Link href="/tasks" className="rounded-xl bg-violet-50 p-3 transition hover:ring-2 hover:ring-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"><p className="flex items-center gap-1.5 text-xs font-semibold text-violet-800"><Clock3 className="h-3.5 w-3.5" />Work sessions</p><p className="mt-1 text-xl font-bold text-violet-900">{visibleSessions.length}</p></Link>
      </div>
      {isLoading ? <Skeleton className="h-36 w-full" /> : displayedTasks.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No assigned tasks yet. New assignments will appear here.</p> : <div className="max-h-[360px] overflow-auto rounded-xl border border-slate-100"><table className="w-full min-w-[780px] text-left text-sm"><thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2.5">Task</th>{canManageTasks && <th className="px-3 py-2.5">Assigned to</th>}<th className="px-3 py-2.5">Project</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Time tracked</th><th className="px-3 py-2.5">Due date</th><th className="px-3 py-2.5">Quick actions</th></tr></thead><tbody>{displayedTasks.map((task) => { const workflowStatus = getTaskWorkflowStatus(task, kanbanPlacements, kanbanColumns); const canEdit = !!user && canUpdateTask(task.user_id, user.user_id, permissionCodes); const awaitingReview = isAwaitingReview(task); const showReviewButton = isTeamLead && (awaitingReview || workflowStatus === "DONE"); const time = taskTimeMap.get(task.task_id); const elapsed = (time?.duration_seconds ?? 0) + (time?.is_tracking && time.active_since ? Math.max(0, Math.floor((clockNow - Date.parse(time.active_since)) / 1000)) : 0); const timeText = `${String(Math.floor(elapsed / 3600)).padStart(2, "0")}:${String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`; const reviewDisabled = workflowStatus === "DONE" || !awaitingReview || !task.team_id || !canMoveKanbanCard || approveKanbanReview.isPending; const reviewTitle = workflowStatus === "DONE" ? "This review has already been approved." : !task.team_id ? "Assign this task to a team before approval." : !canMoveKanbanCard ? "Ask an administrator to grant Kanban cards: Move permission." : undefined; return <tr key={task.task_id} className="border-t border-slate-100"><td className="max-w-[240px] truncate px-3 py-2.5 font-medium text-slate-800">{task.task_name}</td>{canManageTasks && <td className="px-3 py-2.5 text-slate-600">{task.user_id ? task.assignee_name || employeeNameById.get(task.user_id) || "Assigned" : "Unassigned"}</td>}<td className="px-3 py-2.5 text-slate-600">{projectNames.get(task.project_id) || "Project"}</td><td className="px-3 py-2.5"><TaskStatusBadge status={workflowStatus} /></td><td className={`whitespace-nowrap px-3 py-2.5 font-mono text-xs font-semibold ${time?.is_tracking ? "text-emerald-700" : "text-slate-600"}`}>{timeText}{time?.is_tracking ? " · Running" : elapsed > 0 ? " · Saved" : " · —"}</td><td className="px-3 py-2.5 text-slate-600">{formatDate(task.due_date)}</td><td className="px-3 py-2.5"><div className="flex flex-wrap items-center gap-1">{canEdit && <Button size="icon" variant="ghost" aria-label={`Open comments for ${task.task_name}`} title="Comments and activity" onClick={() => setCommentTask(task)}><MessageCircle className="h-4 w-4" /></Button>}{canManageTasks && <Button size="icon" variant="ghost" aria-label={`Edit ${task.task_name}`} title="Edit assignee, due date, or details" onClick={() => setEditingTask(task)}><Pencil className="h-4 w-4" /></Button>}{showReviewButton && <Button size="sm" variant="outline" className="h-8 gap-1.5" disabled={reviewDisabled} title={reviewTitle} onClick={() => void approveReview(task)}>{approvingTaskId === task.task_id ? "Approving…" : workflowStatus === "DONE" ? "Approved" : <><ClipboardCheck className="h-3.5 w-3.5" />Approve</>}</Button>}</div></td></tr>; })}</tbody></table></div>}
      {visibleSessions.length > 0 && <div><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-800">Tracked work history</h3><Badge variant="outline">Shared timer · counted once</Badge></div><div className="max-h-[240px] space-y-2 overflow-y-auto">{visibleSessions.map((session) => <div key={session.work_session_id} className="flex flex-col gap-1 rounded-lg border border-slate-100 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{canManageTasks && visibleEmployeeIds.has(session.user_id) ? `${session.user_name} · ` : ""}{session.task_names.join(", ") || "Work session"}</p><p className="text-xs text-slate-500">{new Date(session.started_at).toLocaleString()}</p></div><span className="shrink-0 text-sm font-semibold text-violet-800">{session.is_running ? "Running" : `${Math.floor(session.duration_seconds / 3600)}h ${Math.floor((session.duration_seconds % 3600) / 60)}m`}</span></div>)}</div></div>}
    </CardContent>
    <TaskFormDialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)} task={editingTask} />
    <TaskActivityDialog task={commentTask} open={!!commentTask} onOpenChange={(open) => !open && setCommentTask(null)} canComment={!!user && canUpdateTask(commentTask?.user_id, user.user_id, permissionCodes)} />
  </Card>;
}
