"use client";

import Link from "next/link";
import { Activity, ArrowRight, ArrowLeft, CalendarDays, CheckCircle2, CheckSquare, ChevronDown, ChevronRight, Clock, FolderKanban, History, Plus, Sparkles, UserPlus, UsersRound, ClipboardCheck, Eye, Download, ExternalLink, FileText, MailPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectStatusBadge } from "@/components/shared/status-badge";
import { ProjectFormDialog } from "@/components/modules/projects/project-form-dialog";
import { TeamFormDialog } from "@/components/modules/teams/team-form-dialog";
import { TaskFormDialog } from "@/components/modules/tasks/task-form-dialog";
import { EventFormDialog } from "@/components/modules/calendar/event-form-dialog";
import { WorkOverview } from "@/components/modules/dashboard/work-overview";
import { useProjects } from "@/hooks/queries/use-projects";
import { useTeamLeads, useTeamMemberCandidates, useTeams } from "@/hooks/queries/use-teams";
import { useApproveKanbanReview, useKanbanColumns, useKanbanTaskPlacements } from "@/hooks/queries/use-kanban";
import { useUsers } from "@/hooks/queries/use-users";
import { useTaskWorkTimes } from "@/hooks/queries/use-tasks";
import { usePermissions } from "@/hooks/use-permissions";
import { useDocuments } from "@/hooks/queries/use-documents";
import { documentsApi } from "@/lib/api/documents";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/api/client";
import { tasksApi } from "@/lib/api/tasks";
import { formatDate } from "@/lib/utils";
import { canAccessModule } from "@/lib/permissions";
import { getTaskWorkflowStatus } from "@/lib/kanban-status";
import { useAuthStore } from "@/store/auth-store";
import type { Task } from "@/types/task";

function StatCard({ icon: Icon, label, value, isLoading, href, tint }: {
  icon: LucideIcon; label: string; value: number; isLoading: boolean; href: string; tint: string;
}) {
  return (
    <Link href={href} className="group block h-full min-w-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2">
      <Card className="metric-card h-full border-white/90 hover:border-violet-100">
        <CardContent className="flex items-center gap-2.5 p-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tint}`}><Icon className="h-4 w-4" /></div>
          <div className="min-w-0 flex-1"><p className="break-words text-[11px] font-bold leading-4 text-violet-700">{label}</p>{isLoading ? <Skeleton className="mt-1 h-6 w-8" /> : <p className="mt-0.5 text-xl font-bold tracking-tight text-slate-900">{value}</p>}</div>
          <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-violet-500" />
        </CardContent>
      </Card>
    </Link>
  );
}

const resourceWasEdited = (resource: { created_at: string; updated_at?: string | null }) =>
  !!resource.updated_at && new Date(resource.updated_at).getTime() - new Date(resource.created_at).getTime() > 1000;

const formatActivityTimestamp = (value: string) => new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(value));

const localDateKey = (value = new Date()) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;

const formatTaskStatus = (status: string) => ({
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
  BLOCKED: "Blocked",
  CANCELLED: "Cancelled",
}[status] ?? status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()));

export default function DashboardPage() {
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [taskPage, setTaskPage] = useState(0);
  const [expandedActivityTaskId, setExpandedActivityTaskId] = useState<string | null>(null);
  const [approvingTaskId, setApprovingTaskId] = useState<string | null>(null);
  const [approvedReviewTaskIds, setApprovedReviewTaskIds] = useState<Set<string>>(() => new Set());
  const [clockNow, setClockNow] = useState(Date.now());
  const user = useAuthStore((s) => s.user);
  const { permissionCodes, isLoading: permissionsLoading } = usePermissions();
  const isProjectManager = (user?.role_names ?? []).some((role) => role.trim().toLowerCase() === "project manager");
  const canCreateProject = permissionCodes.includes("projects.create");
  const canCreateTeam = permissionCodes.includes("teams.create") || ["teams.members.create", "teams.members.update", "teams.members.delete"].some((code) => permissionCodes.includes(code));
  const canCreateInvitation = permissionCodes.includes("invitations.create") && permissionCodes.includes("users.view");
  const canViewTeams = ["teams.view", "teams.manage", "teams.members.view", "teams.members.manage", "teams.leads.view"].some((code) => permissionCodes.includes(code));
  // The flexible permission API returns the selected CRUD codes, not the legacy
  // `*.manage` aliases. Treat project CRUD as sufficient to load the user's
  // assigned project list on their dashboard.
  const canViewProjects = permissionCodes.includes("roles.manage") || canViewTeams || ["projects.view", "projects.create", "projects.update", "projects.delete", "tasks.view", "tasks.create", "tasks.update", "tasks.delete"].some((code) => permissionCodes.includes(code));
  const canOpenProjects = canAccessModule("/projects", permissionCodes);
  const canCreateTask = permissionCodes.includes("tasks.create") && canViewProjects;
  const canCreateEvent = permissionCodes.includes("calendar.create") && canViewProjects;
  const canAccessCalendar = canAccessModule("/calendar", permissionCodes);
  const hasQuickActions = canCreateProject || canCreateTeam || canCreateTask || canCreateEvent || canCreateInvitation || permissionCodes.includes("roles.manage");
  const canViewTasks = permissionCodes.includes("tasks.view");
  // Assigned developers/testers can read their own tasks with this permission;
  // the API scopes their task list to assignments for the signed-in user.
  const canViewAssignedTasks = permissionCodes.includes("tasks.update_assigned");
  const canAccessTasks = canViewTasks || canViewAssignedTasks;
  const canViewUsers = permissionCodes.includes("users.view");
  const canViewWork = permissionCodes.includes("tasks.work_sessions.view");
  const { data: projects, isLoading: projectsLoading } = useProjects({ limit: 500 }, canViewProjects);
  const showSharedResources = permissionCodes.includes("documents.view");
  const { data: sharedResources, isLoading: resourcesLoading } = useDocuments(showSharedResources);
  const canMoveKanban = permissionCodes.includes("kanban.tasks.move");
  const { data: teams } = useTeams(canViewTeams);
  const { data: teamLeads } = useTeamLeads(canViewTeams);
  const myTeamLeadIds = new Set((teamLeads ?? []).filter((lead) => lead.user_id === user?.user_id).map((lead) => lead.team_lead_id));
  const canViewMyTeamTaskTimes = canViewTasks && myTeamLeadIds.size > 0 && permissionCodes.includes("tasks.work_time.view");
  const { data: taskWorkTimes = [] } = useTaskWorkTimes(canViewMyTeamTaskTimes);
  const { data: teamMemberCandidates = [] } = useTeamMemberCandidates(canViewTeams);
  // Team Leads need read-only placements to report each developer's actual
  // column even when their role cannot move Kanban cards.
  const canReadTeamKanban = myTeamLeadIds.size > 0;
  const { data: kanbanColumns = [] } = useKanbanColumns(canReadTeamKanban);
  const { data: kanbanPlacements = [] } = useKanbanTaskPlacements(canReadTeamKanban);
  const approveKanbanReview = useApproveKanbanReview();
  const { data: employees } = useUsers(undefined, canViewUsers);
  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["tasks", "dashboard"],
    queryFn: () => tasksApi.list({ limit: 500 }),
    enabled: canAccessTasks,
    // Deletions are made in the Team Lead's session; poll so the PM's
    // dashboard counts and project summaries converge without a manual reload.
    refetchInterval: canAccessTasks ? 2_000 : false,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });
  const adminTaskPageSize = 100;
  const { data: organizationTaskPage, isLoading: organizationTasksLoading } = useQuery({
    queryKey: ["tasks", "organization-register", taskPage],
    queryFn: () => tasksApi.list({ limit: adminTaskPageSize, skip: taskPage * adminTaskPageSize }),
    enabled: canAccessTasks,
    refetchInterval: 2_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });
  const dashboardProjects = isProjectManager
    ? (projects ?? []).filter((project) => project.project_manager_user_id === user?.user_id)
    : projects ?? [];
  const dashboardProjectIds = new Set(dashboardProjects.map((project) => project.project_id));
  const dashboardTasks = isProjectManager
    ? (tasks ?? []).filter((task) => dashboardProjectIds.has(task.project_id))
    : tasks ?? [];
  const projectNameById = new Map(dashboardProjects.map((project) => [project.project_id, project.project_name]));
  const employeeNameById = new Map([
    ...teamMemberCandidates.map((member) => [member.user_id, member.name] as const),
    ...(employees ?? []).map((employee) => [employee.user_id, employee.name] as const),
  ]);
  const taskWorkTimeById = new Map(taskWorkTimes.map((workTime) => [workTime.task_id, workTime]));
  const hasRunningVisibleTask = taskWorkTimes.some((workTime) => workTime.is_reported_tracking ?? workTime.is_tracking);
  useEffect(() => {
    if (!hasRunningVisibleTask) return;
    const intervalId = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [hasRunningVisibleTask]);
  const taskTimeLabel = (taskId: string) => {
    const workTime = taskWorkTimeById.get(taskId);
    const elapsed = (workTime?.reported_duration_seconds ?? workTime?.duration_seconds ?? 0) + (
      (workTime?.is_reported_tracking ?? workTime?.is_tracking) && workTime.active_since
        ? Math.max(0, Math.floor((clockNow - Date.parse(workTime.active_since)) / 1000))
        : 0
    );
    if (elapsed === 0) return workTime?.pending_review_seconds ? "Pending PM approval" : "—";
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    const formatted = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    return `${formatted} · ${(workTime?.is_reported_tracking ?? workTime?.is_tracking) ? "Running" : workTime?.pending_review_seconds ? "Pending PM approval" : "Saved"}`;
  };

  const totalProjects = dashboardProjects.length;
  const totalTasks = dashboardTasks.length;
  const localToday = localDateKey();
  const dashboardTaskStatus = (task: Task) => getTaskWorkflowStatus(task, kanbanPlacements, kanbanColumns);
  const completedTasks = dashboardTasks.filter((task) => dashboardTaskStatus(task) === "DONE").length;
  const overdueProjectTasks = dashboardTasks.filter((task) => task.due_date && task.due_date < localToday && !["DONE", "CANCELLED"].includes(dashboardTaskStatus(task)));
  const inProgressTasks = dashboardTasks.filter((task) => dashboardTaskStatus(task) === "IN_PROGRESS").length;
  const reviewTasks = dashboardTasks.filter((task) => dashboardTaskStatus(task) === "IN_REVIEW").length;
  const todoTasks = dashboardTasks.filter((task) => dashboardTaskStatus(task) === "TODO").length;
  const completionRate = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const myTasks = tasks?.filter((task) => task.user_id === user?.user_id) ?? [];
  const myLeadTeamIds = new Set((teams ?? []).filter((team) => myTeamLeadIds.has(team.team_lead_id)).map((team) => team.team_id));
  // Keep review controls discoverable for Team Leads; RBAC still guards the action.
  const canShowReviewActions = myTeamLeadIds.size > 0;
  // The team assignment is the source of truth: don't hide a lead's task list
  // just because an assignee's configurable role name differs from "Developer".
  const isMyTeamTask = (task: Task) => !!task.team_id && !!task.user_id && myLeadTeamIds.has(task.team_id);
  const isTaskInDoneColumn = (task: Task) => {
    const workflowStatus = getTaskWorkflowStatus(task, kanbanPlacements, kanbanColumns);
    if (workflowStatus === "DONE") return true;
    // The task's explicit review status wins over a stale Done placement; the
    // Team Lead must still be able to approve it and synchronize the card.
    if (workflowStatus === "IN_REVIEW") return false;
    return kanbanPlacements.some((placement) => {
    if (placement.task_id !== task.task_id) return false;
    const column = kanbanColumns.find((item) => item.column_id === placement.column_id);
    return !!column && ["done", "complete", "completed"].includes(column.column_name.trim().toLowerCase());
    });
  };
  const taskIsAwaitingTeamLeadReview = (task: Task) => {
    // Ignore stale review placements after the task has already reached Done.
    if (isTaskInDoneColumn(task)) return false;
    return getTaskWorkflowStatus(task, kanbanPlacements, kanbanColumns) === "IN_REVIEW" || kanbanPlacements.some((placement) => {
      if (placement.task_id !== task.task_id) return false;
      const column = kanbanColumns.find((item) => item.column_id === placement.column_id);
      return !!column && ["in review", "in-review", "review"].includes(column.column_name.trim().toLowerCase());
    });
  };
  const isAwaitingTeamLeadReview = (task: Task) =>
    !approvedReviewTaskIds.has(task.task_id) && taskIsAwaitingTeamLeadReview(task);
  const dashboardTaskPage = canShowReviewActions
    ? (organizationTaskPage ?? []).filter(isMyTeamTask)
    : organizationTaskPage ?? [];
  useEffect(() => {
    setApprovedReviewTaskIds((current) => {
      const next = new Set(current);
      for (const task of dashboardTaskPage) {
        if (next.has(task.task_id) && !taskIsAwaitingTeamLeadReview(task)) next.delete(task.task_id);
      }
      return next.size === current.size ? current : next;
    });
  }, [dashboardTaskPage, kanbanPlacements, kanbanColumns]);
  const { data: expandedTaskActivity = [], isLoading: activityLoading } = useQuery({
    queryKey: ["tasks", expandedActivityTaskId, "activity"],
    queryFn: () => tasksApi.getActivity(expandedActivityTaskId as string),
    enabled: !!expandedActivityTaskId && canShowReviewActions,
    refetchInterval: expandedActivityTaskId && canShowReviewActions ? 5_000 : false,
  });
  const taskTableColumnCount = 6 + Number(canViewMyTeamTaskTimes) + (canShowReviewActions ? 2 : 0);
  const roleStats = [
    ...(canAccessTasks ? isProjectManager ? [
        { icon: CheckSquare, label: "Project work", value: totalTasks, tint: "bg-sky-100 text-sky-700" },
        { icon: CheckCircle2, label: "Work done", value: completedTasks, tint: "bg-emerald-100 text-emerald-700" },
        { icon: Clock, label: "Overdue work", value: overdueProjectTasks.length, tint: "bg-rose-100 text-rose-700" },
      ] : [
        { icon: CheckSquare, label: "My Tasks", value: myTasks.length, tint: "bg-sky-100 text-sky-700" },
        { icon: Clock, label: "Overdue", value: myTasks.filter((task) => task.due_date && task.due_date < localToday && !["DONE", "CANCELLED"].includes(dashboardTaskStatus(task))).length, tint: "bg-rose-100 text-rose-700" },
      ] : []),
    ...(canViewProjects ? [{ icon: FolderKanban, label: "Projects", value: totalProjects, tint: "bg-violet-100 text-violet-700" }] : []),
    ...(canViewTeams ? [{ icon: UsersRound, label: "Teams", value: teams?.length ?? 0, tint: "bg-indigo-100 text-indigo-700" }] : []),
  ];
  const recentProjects = [...dashboardProjects].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 5);
  const downloadSharedResource = async (resourceId: string, filename: string) => {
    try { await documentsApi.download(resourceId, filename); }
    catch (error) { toast.error(getApiErrorMessage(error)); }
  };
  const approveReviewTask = async (task: Task) => {
    if (!isAwaitingTeamLeadReview(task) || !isMyTeamTask(task) || approvedReviewTaskIds.has(task.task_id) || approvingTaskId === task.task_id) return;
    setApprovingTaskId(task.task_id);
    try {
      await approveKanbanReview.mutateAsync(task.task_id);
      setApprovedReviewTaskIds((current) => new Set(current).add(task.task_id));
      toast.success("Review approved; the task moved to Done and the developer was notified.");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setApprovingTaskId(null);
    }
  };

  return (
    <div className="workspace-page animate-enter !space-y-4">
      <section className="relative isolate flex flex-col justify-between gap-4 overflow-hidden rounded-3xl bg-gradient-to-br from-[#302c83] via-[#5146d9] to-[#7868f8] px-5 py-5 text-white shadow-xl shadow-indigo-900/15 sm:flex-row sm:items-center sm:px-7 sm:py-6">
        <div className="pointer-events-none absolute -right-12 -top-28 -z-10 h-80 w-80 rounded-full border-[42px] border-white/[0.07]" />
        <div className="pointer-events-none absolute -bottom-44 right-40 -z-10 h-72 w-72 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="min-w-0">
          <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-100"><Sparkles className="h-3.5 w-3.5" /> Workspace command center</p>
          <h1 className="break-words text-xl font-bold tracking-tight sm:text-2xl">Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""} <span aria-hidden="true">✦</span></h1>
          <p className="mt-1.5 max-w-lg text-xs text-violet-100/90 sm:text-sm">A clear view of the work in motion, what needs attention, and where your team is headed.</p>
        </div>
        <div className="relative z-10 flex shrink-0 flex-wrap gap-2">
          {canOpenProjects && <Button asChild variant="secondary" className="bg-white text-indigo-700 shadow-lg hover:bg-violet-50"><Link href="/projects">Explore projects <ArrowRight className="h-4 w-4" /></Link></Button>}
        </div>
      </section>

      {showSharedResources && <Card className="min-w-0 overflow-hidden border-white/90">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0 flex-1"><CardTitle className="text-base font-bold text-violet-800">Shared project resources</CardTitle><p className="mt-1 text-xs text-slate-500">Files and links shared with your delivery roles.</p></div>
          <Button asChild size="sm" variant="outline"><Link href="/documentation">Browse all</Link></Button>
        </CardHeader>
        <CardContent className="space-y-2 p-4">
          {resourcesLoading ? <Skeleton className="h-14 w-full" /> : (sharedResources ?? []).length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No shared resources have been added yet.</p> :
            [...(sharedResources ?? [])].sort((a, b) => new Date(b.updated_at ?? b.created_at).getTime() - new Date(a.updated_at ?? a.created_at).getTime()).slice(0, 5).map((resource) => (
              <div key={resource.document_id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><FileText className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{resource.title}</p><p className="mt-1 truncate text-[11px] text-slate-500">Added by {resource.created_by || "Unknown user"}{resourceWasEdited(resource) && resource.updated_by ? ` · Edited by ${resource.updated_by}` : ""}</p></div>
                {resource.resource_type === "FILE" && resource.original_filename ? <Button size="icon" variant="ghost" aria-label={`Download ${resource.title}`} onClick={() => void downloadSharedResource(resource.document_id, resource.original_filename!)}><Download className="h-4 w-4" /></Button> : resource.resource_type !== "FILE" && resource.file_url ? <Button asChild size="icon" variant="ghost" aria-label={`Open ${resource.title}`}><a href={resource.file_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a></Button> : null}
              </div>
            ))}
        </CardContent>
      </Card>}

      <Card className="border-indigo-100 bg-gradient-to-r from-indigo-50/80 via-white to-violet-50/60">
        <CardContent className="flex min-w-0 items-center gap-3 p-3 sm:p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
            <Activity className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-600">Workspace overview</p>
            <h2 className="mt-1 text-base font-bold text-violet-800">{permissionsLoading ? "Loading your dashboard" : "Your workspace at a glance"}</h2>
            <p className="mt-1 text-sm text-slate-600">Your modules and actions follow your assigned permissions.</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {roleStats.map((stat) => (
          <StatCard key={stat.label} icon={stat.icon} label={stat.label} value={stat.value} isLoading={tasksLoading || (canViewTeams && !teams) || (canViewProjects && !projects)} href={stat.label.includes("Team") ? "/teams" : stat.label.includes("Project") ? "/projects" : "/tasks"} tint={stat.tint} />
        ))}
        {canViewUsers && <StatCard icon={UserPlus} label="Employees" value={employees?.length ?? 0} isLoading={!employees} href="/users" tint="bg-amber-100 text-amber-700" />}
      </div>

      <Card className="min-w-0 border-white/90">
        <CardContent className="flex min-w-0 flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0"><h2 className="text-sm font-bold text-violet-800">Quick actions</h2><p className="mt-1 text-xs text-slate-500">Start common work from one place. Actions follow your assigned permissions.</p></div>
          <div className="flex min-w-0 flex-wrap gap-2">
            {permissionsLoading ? <Skeleton className="h-10 w-36" /> : <>
              {canCreateProject && <Button size="sm" onClick={() => setProjectDialogOpen(true)}><Plus className="h-4 w-4" /> New project</Button>}
              {canCreateTeam && <Button size="sm" variant="outline" onClick={() => setTeamDialogOpen(true)}><UsersRound className="h-4 w-4" /> Add team</Button>}
              {canCreateTask && <Button size="sm" variant="outline" onClick={() => setTaskDialogOpen(true)}><CheckSquare className="h-4 w-4" /> New task</Button>}
              {canCreateEvent && <Button size="sm" variant="outline" onClick={() => setEventDialogOpen(true)}><CalendarDays className="h-4 w-4" /> Schedule event</Button>}
              {canCreateInvitation && <Button asChild size="sm" variant="outline"><Link href="/users#invite-employee"><MailPlus className="h-4 w-4" /> Create invitation</Link></Button>}
              {permissionCodes.includes("roles.manage") && <Button asChild size="sm" variant="outline"><Link href="/roles"><Eye className="h-4 w-4" /> Review roles</Link></Button>}
              {!hasQuickActions && <p className="self-center text-xs text-slate-500">Open your workspace modules to manage your work.</p>}
            </>}
          </div>
        </CardContent>
      </Card>

      {canViewProjects && <Card className="min-w-0 overflow-hidden border-white/90">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
          <div className="min-w-0 flex-1"><CardTitle className="text-base font-bold text-violet-800">Projects</CardTitle><p className="mt-1 text-xs text-slate-500">Open a project workspace to see its boards and team work.</p></div>
          <Link href="/projects" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-violet-700 hover:text-violet-900">Manage projects <ArrowRight className="h-3.5 w-3.5" /></Link>
        </CardHeader>
        <CardContent className="grid max-h-[420px] gap-2 overflow-y-auto p-3 sm:grid-cols-2 sm:p-4">
          {projectsLoading ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />) : dashboardProjects.length === 0 ? <p className="col-span-full rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">{isProjectManager ? "No projects are assigned to you yet." : "There are no projects yet. Use the New project button above to create one."}</p> : dashboardProjects.map((project) => <div key={project.project_id} className="group flex min-w-0 items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 transition hover:border-violet-200 hover:bg-violet-50/50">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><FolderKanban className="h-4 w-4" /></span><Link href={`/projects/${project.project_id}`} className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{project.project_name}</span><span className="mt-1 block truncate text-[11px] text-slate-500">{project.description || `Updated ${formatDate(project.updated_at)}`}</span><span className="mt-1 block text-[10px] font-medium text-slate-500">{project.due_date ? `Due ${formatDate(project.due_date)}` : "No due date set"}</span></Link><ProjectStatusBadge status={project.status} /><Link href={`/projects/${project.project_id}#project-work`} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100" aria-label={`Open ${project.project_name} Kanban board`}>Board <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>)}
        </CardContent>
      </Card>}

      {canAccessTasks && <Card className="min-w-0 overflow-hidden border-white/90">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
          <div className="min-w-0 flex-1"><CardTitle className="text-base font-bold text-violet-800">{canShowReviewActions ? "Team developer work" : isProjectManager ? "Project task register" : canViewTasks ? "Organization task register" : "My assigned tasks"}</CardTitle><p className="mt-1 text-xs text-slate-500">{canShowReviewActions ? "Tasks, checklist progress, tracked time, and developer activity for your assigned team." : isProjectManager ? "Status, assignees, and due dates for work on projects assigned to you." : canViewTasks ? "Every project work item, including subtasks. Select a project to open its full workspace." : "Tasks assigned to you, with project, status, and due date."}</p></div>
          <Link href="/tasks" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-violet-700 hover:text-violet-900">Open task module <ArrowRight className="h-3.5 w-3.5" /></Link>
        </CardHeader>
        <CardContent className="p-0">
          {organizationTasksLoading ? <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}</div> : <>
            {dashboardTaskPage.length === 0 ? <p className="p-5 text-center text-sm text-slate-500">{canShowReviewActions ? "No developer tasks are assigned to your team yet." : "No work items found on this page."}</p> : <div className="overflow-x-auto"><table className={`w-full ${canShowReviewActions ? "min-w-[1160px]" : canViewMyTeamTaskTimes ? "min-w-[850px]" : "min-w-[760px]"} text-left text-xs`}><thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Work item</th><th className="px-4 py-3">Project</th><th className="px-4 py-3">Assigned to</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Due</th>{canViewMyTeamTaskTimes && <th className="px-4 py-3">Time taken</th>}{canShowReviewActions && <><th className="px-4 py-3">Developer updates</th><th className="px-4 py-3">Review</th></>}</tr></thead><tbody className="divide-y divide-slate-100">{dashboardTaskPage.map((task) => <Fragment key={task.task_id}>
              <tr key={task.task_id} className="hover:bg-violet-50/40"><td className="max-w-[260px] px-4 py-3"><span className="block truncate font-semibold text-slate-800">{task.task_name}</span>{!!task.checklist_items?.length && <div className="mt-2 rounded-lg bg-slate-50 p-2"><p className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-slate-500"><CheckSquare className="h-3 w-3" />Checklist · {task.checklist_items.filter((item) => item.is_completed).length}/{task.checklist_items.length}</p><ul className="max-h-24 space-y-1 overflow-y-auto">{task.checklist_items.map((item) => <li key={item.item_id} className="flex items-start gap-1.5 text-[11px]"><CheckCircle2 className={`mt-0.5 h-3 w-3 shrink-0 ${item.is_completed ? "text-emerald-600" : "text-slate-300"}`} /><span className={item.is_completed ? "text-slate-400 line-through" : "text-slate-600"}>{item.text}</span></li>)}</ul></div>}</td><td className="max-w-[200px] px-4 py-3"><Link href={`/projects/${task.project_id}`} className="block truncate font-semibold text-violet-700 hover:underline">{projectNameById.get(task.project_id) ?? "Project"}</Link></td><td className="px-4 py-3 text-slate-600">{employeeNameById.get(task.user_id ?? "") || task.assignee_name || (task.user_id ? "Assigned" : "Unassigned")}</td><td className="px-4 py-3 text-slate-600">{task.task_type ?? "TASK"}</td><td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-700">{formatTaskStatus(getTaskWorkflowStatus(task, kanbanPlacements, kanbanColumns))}</span></td><td className="whitespace-nowrap px-4 py-3 text-slate-500">{task.due_date ? formatDate(task.due_date) : "—"}</td>{canViewMyTeamTaskTimes && <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-slate-600">{taskTimeLabel(task.task_id)}</td>}{canShowReviewActions && <><td className="px-4 py-3"><Button size="sm" variant="outline" className="gap-1.5" onClick={() => setExpandedActivityTaskId((current) => current === task.task_id ? null : task.task_id)}><History className="h-3.5 w-3.5" />{expandedActivityTaskId === task.task_id ? "Hide updates" : "View updates"}{expandedActivityTaskId === task.task_id ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</Button><p className="mt-1.5 whitespace-nowrap text-[10px] text-slate-400">Updated {formatActivityTimestamp(task.updated_at)}</p></td><td className="px-4 py-3">{isMyTeamTask(task) && <Button size="sm" variant="outline" className="gap-1.5 border-emerald-200 bg-emerald-50 font-semibold text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-800" disabled={!isAwaitingTeamLeadReview(task) || isTaskInDoneColumn(task) || approvedReviewTaskIds.has(task.task_id) || !canMoveKanban || approvingTaskId === task.task_id || approveKanbanReview.isPending} title={!canMoveKanban ? "Ask an administrator to grant Kanban cards: Move permission." : undefined} onClick={() => void approveReviewTask(task)}>{approvingTaskId === task.task_id ? "Approving…" : (isTaskInDoneColumn(task) || approvedReviewTaskIds.has(task.task_id)) ? "Approved" : !isAwaitingTeamLeadReview(task) ? "Waiting for review" : <><ClipboardCheck className="h-3.5 w-3.5" />Approve</>}</Button>}</td></>}</tr>
              {canShowReviewActions && expandedActivityTaskId === task.task_id && <tr key={`${task.task_id}-activity`} className="bg-indigo-50/40"><td colSpan={taskTableColumnCount} className="px-5 py-4"><div className="mb-3 flex items-center gap-2 text-xs font-bold text-indigo-800"><Activity className="h-4 w-4" />Developer work history · {task.task_name}</div>{activityLoading ? <Skeleton className="h-12 w-full" /> : expandedTaskActivity.length === 0 ? <p className="rounded-lg bg-white/80 p-3 text-xs text-slate-500">No developer updates have been recorded for this task yet.</p> : <ol className="max-h-72 space-y-3 overflow-y-auto rounded-xl border border-indigo-100 bg-white/80 p-3">{expandedTaskActivity.map((entry) => <li key={entry.activity_id} className="flex gap-2.5 text-xs"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-400" /><div className="min-w-0 flex-1"><p className="font-semibold text-slate-700">{entry.actor_name ?? "Workspace member"}<span className="ml-2 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-indigo-700">{entry.event_type.replaceAll("_", " ")}</span></p><p className="mt-1 break-words text-slate-600">{entry.details}</p><time className="mt-1 block text-[10px] text-slate-400">{formatActivityTimestamp(entry.created_at)}</time></div></li>)}</ol>}</td></tr>}
            </Fragment>)}</tbody></table></div>}
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3"><span className="text-[11px] text-slate-500">Page {taskPage + 1} · {dashboardTaskPage.length} work items</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={taskPage === 0} onClick={() => { setExpandedActivityTaskId(null); setTaskPage((page) => Math.max(0, page - 1)); }}><ArrowLeft className="h-3.5 w-3.5" /> Previous</Button><Button size="sm" variant="outline" disabled={(organizationTaskPage?.length ?? 0) < adminTaskPageSize} onClick={() => { setExpandedActivityTaskId(null); setTaskPage((page) => page + 1); }}>Next <ArrowRight className="h-3.5 w-3.5" /></Button></div></div>
          </>}
        </CardContent>
      </Card>}

      {canViewWork && canAccessTasks && <WorkOverview />}

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
        {canViewProjects && <Card className="min-w-0 overflow-hidden border-white/90">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
            <div className="min-w-0 flex-1"><CardTitle className="text-base font-bold text-violet-800">Recent projects</CardTitle><p className="mt-1 text-xs text-slate-500">Latest updates from your workspace</p></div>
            <Link href="/projects" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-violet-700 hover:text-violet-900">View all <ArrowRight className="h-3.5 w-3.5" /></Link>
          </CardHeader>
          <CardContent className="space-y-2 p-4">
            {projectsLoading ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />) : recentProjects.length === 0 ? (
              <div className="py-8 text-center"><FolderKanban className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 text-sm font-medium text-slate-700">No projects yet</p><p className="mt-1 text-xs text-slate-500">Create a project to start organizing work.</p></div>
            ) : recentProjects.map((project) => (
              <Link key={project.project_id} href={`/projects/${project.project_id}`} className="group flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-transparent bg-white p-3 transition hover:border-violet-100 hover:bg-violet-50/40 sm:flex-nowrap">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-sky-100 text-violet-700"><FolderKanban className="h-4 w-4" /></div>
                  <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{project.project_name}</p><p className="mt-1 text-[11px] text-slate-500">Updated {formatDate(project.updated_at)}</p></div>
                </div>
                <div className="flex shrink-0 items-center gap-2"><ProjectStatusBadge status={project.status} /><ArrowRight className="hidden h-4 w-4 text-violet-400 transition group-hover:translate-x-0.5 sm:block" /></div>
              </Link>
            ))}
          </CardContent>
        </Card>}

        <Card className="min-w-0 overflow-hidden border-white/90">
          <CardHeader className="flex flex-row items-center gap-3 border-b border-slate-100 px-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700"><Activity className="h-5 w-5" /></div>
            <div><CardTitle className="text-base font-bold text-violet-800">Delivery pulse</CardTitle><p className="mt-1 text-xs text-slate-500">Task progress at a glance</p></div>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs font-bold text-violet-700">Completion rate</p><p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{completionRate}<span className="text-lg text-slate-400">%</span></p></div><div className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">{completedTasks} done</div></div>
            <Progress value={completionRate} className="h-2.5 bg-slate-100 [&>div]:bg-gradient-to-r [&>div]:from-violet-500 [&>div]:to-indigo-400" />
            <div className="space-y-3">
              {[{ label: "In progress", count: inProgressTasks, color: "bg-sky-500" }, { label: "In review", count: reviewTasks, color: "bg-amber-500" }, { label: "To do", count: todoTasks, color: "bg-slate-400" }].map((item) => <div key={item.label} className="flex items-center gap-3"><div className={`h-2 w-2 rounded-full ${item.color}`} /><span className="flex-1 text-xs font-bold text-violet-700">{item.label}</span><span className="text-xs font-semibold text-slate-800">{item.count}</span><span className="w-9 text-right text-[10px] text-slate-400">{totalTasks ? Math.round((item.count / totalTasks) * 100) : 0}%</span></div>)}
            </div>
            {canAccessCalendar && <Link href="/calendar" className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-3 text-xs font-semibold text-slate-700 transition hover:bg-violet-50 hover:text-violet-700"><span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Open calendar</span><ArrowRight className="h-3.5 w-3.5" /></Link>}
          </CardContent>
        </Card>
      </div>

      {canCreateProject && <ProjectFormDialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen} />}
      {canCreateTeam && <TeamFormDialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen} />}
      {canCreateTask && <TaskFormDialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen} />}
      {canCreateEvent && <EventFormDialog open={eventDialogOpen} onOpenChange={setEventDialogOpen} />}
    </div>
  );
}
