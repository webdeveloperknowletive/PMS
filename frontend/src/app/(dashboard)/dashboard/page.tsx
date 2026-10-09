"use client";

import Link from "next/link";
import { Activity, ArrowRight, CalendarDays, CheckCircle2, CheckSquare, Clock, FolderKanban, Plus, Sparkles, UserPlus, UsersRound, ClipboardCheck, Eye, Download, ExternalLink, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectStatusBadge } from "@/components/shared/status-badge";
import { ProjectFormDialog } from "@/components/modules/projects/project-form-dialog";
import { TaskFormDialog } from "@/components/modules/tasks/task-form-dialog";
import { TeamFormDialog } from "@/components/modules/teams/team-form-dialog";
import { UserFormDialog } from "@/components/modules/users/user-form-dialog";
import { useProjects } from "@/hooks/queries/use-projects";
import { useTeamLeads, useTeams } from "@/hooks/queries/use-teams";
import { useUsers } from "@/hooks/queries/use-users";
import { usePermissions } from "@/hooks/use-permissions";
import { useDocuments } from "@/hooks/queries/use-documents";
import { documentsApi } from "@/lib/api/documents";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/api/client";
import { tasksApi } from "@/lib/api/tasks";
import { formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

function StatCard({ icon: Icon, label, value, isLoading, href, tint }: {
  icon: LucideIcon; label: string; value: number; isLoading: boolean; href: string; tint: string;
}) {
  return (
    <Link href={href} className="group block h-full min-w-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2">
      <Card className="metric-card h-full border-white/90 hover:border-violet-100">
        <CardContent className="flex items-center gap-2.5 p-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tint}`}><Icon className="h-4 w-4" /></div>
          <div className="min-w-0 flex-1"><p className="break-words text-[11px] font-semibold leading-4 text-slate-500">{label}</p>{isLoading ? <Skeleton className="mt-1 h-6 w-8" /> : <p className="mt-0.5 text-xl font-bold tracking-tight text-slate-900">{value}</p>}</div>
          <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-violet-500" />
        </CardContent>
      </Card>
    </Link>
  );
}

const ROLE_DASHBOARDS = [
  { role: "Admin", title: "Organization overview", description: "Review workspace activity and manage people, roles, projects, and teams." },
  { role: "Project Manager", title: "Project delivery", description: "Track project health, coordinate teams, and keep delivery moving." },
  { role: "Team Lead", title: "Team delivery", description: "Keep your team’s assigned work, reviews, and deadlines on track." },
  { role: "Developer", title: "My development work", description: "Focus on your assigned work and the tasks that need attention." },
  { role: "Tester", title: "My testing queue", description: "Focus on assigned work and tasks waiting for verification." },
  { role: "Viewer", title: "Project overview", description: "Review project progress and delivery status in read-only mode." },
];

const ROLE_PRIORITY = ["Admin", "Project Manager", "Team Lead", "Developer", "Tester", "Viewer"];
const resourceWasEdited = (resource: { created_at: string; updated_at?: string | null }) =>
  !!resource.updated_at && new Date(resource.updated_at).getTime() - new Date(resource.created_at).getTime() > 1000;

export default function DashboardPage() {
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const { canManageProjects, canManageTasks, canManageTeams, canManageUsers, roleNames, isLoading: permissionsLoading } = usePermissions();
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const showSharedResources = roleNames.some((role) => ["Project Manager", "Team Lead", "Developer", "Tester"].includes(role));
  const { data: sharedResources, isLoading: resourcesLoading } = useDocuments(showSharedResources);
  const { data: teams } = useTeams();
  const { data: teamLeads } = useTeamLeads();
  const { data: employees } = useUsers(undefined, canManageUsers);
  const { data: tasks, isLoading: tasksLoading } = useQuery({ queryKey: ["tasks", "dashboard"], queryFn: () => tasksApi.list({ limit: 200 }) });

  const totalProjects = projects?.length ?? 0;
  const totalTasks = tasks?.length ?? 0;
  const completedTasks = tasks?.filter((task) => task.status === "DONE").length ?? 0;
  const overdueTasks = tasks?.filter((task) => task.due_date && new Date(task.due_date) < new Date() && task.status !== "DONE").length ?? 0;
  const inProgressTasks = tasks?.filter((task) => task.status === "IN_PROGRESS").length ?? 0;
  const reviewTasks = tasks?.filter((task) => task.status === "IN_REVIEW").length ?? 0;
  const todoTasks = tasks?.filter((task) => task.status === "TODO").length ?? 0;
  const completionRate = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const myTasks = tasks?.filter((task) => task.user_id === user?.user_id) ?? [];
  const myTeamLeadIds = new Set((teamLeads ?? []).filter((lead) => lead.user_id === user?.user_id).map((lead) => lead.team_lead_id));
  const myTeams = (teams ?? []).filter((team) => myTeamLeadIds.has(team.team_lead_id));
  const activeRole = ROLE_PRIORITY.find((role) => roleNames.includes(role));
  const roleDashboard = ROLE_DASHBOARDS.find((profile) => profile.role === activeRole);
  const roleStats = activeRole === "Developer"
    ? [
        { icon: CheckSquare, label: "My Tasks", value: myTasks.length, tint: "bg-sky-100 text-sky-700" },
        { icon: Clock, label: "In Progress", value: myTasks.filter((task) => task.status === "IN_PROGRESS").length, tint: "bg-indigo-100 text-indigo-700" },
        { icon: CheckCircle2, label: "Completed", value: myTasks.filter((task) => task.status === "DONE").length, tint: "bg-emerald-100 text-emerald-700" },
        { icon: Clock, label: "Overdue", value: myTasks.filter((task) => task.due_date && new Date(task.due_date) < new Date() && task.status !== "DONE").length, tint: "bg-rose-100 text-rose-700" },
      ]
    : activeRole === "Tester"
      ? [
          { icon: ClipboardCheck, label: "Assigned for Review", value: myTasks.filter((task) => task.status === "IN_REVIEW").length, tint: "bg-amber-100 text-amber-700" },
          { icon: CheckSquare, label: "My Tasks", value: myTasks.length, tint: "bg-sky-100 text-sky-700" },
          { icon: CheckCircle2, label: "Verified", value: myTasks.filter((task) => task.status === "DONE").length, tint: "bg-emerald-100 text-emerald-700" },
          { icon: Clock, label: "Overdue", value: myTasks.filter((task) => task.due_date && new Date(task.due_date) < new Date() && task.status !== "DONE").length, tint: "bg-rose-100 text-rose-700" },
        ]
      : activeRole === "Team Lead"
        ? [
            { icon: UsersRound, label: "Teams I Lead", value: myTeams.length, tint: "bg-indigo-100 text-indigo-700" },
            { icon: CheckSquare, label: "Assigned to Me", value: myTasks.length, tint: "bg-sky-100 text-sky-700" },
            { icon: ClipboardCheck, label: "In Review", value: reviewTasks, tint: "bg-amber-100 text-amber-700" },
            { icon: Clock, label: "Overdue", value: overdueTasks, tint: "bg-rose-100 text-rose-700" },
          ]
        : activeRole === "Viewer"
          ? [
              { icon: FolderKanban, label: "Projects", value: totalProjects, tint: "bg-violet-100 text-violet-700" },
              { icon: UsersRound, label: "Teams", value: teams?.length ?? 0, tint: "bg-indigo-100 text-indigo-700" },
              { icon: CheckSquare, label: "Tasks", value: totalTasks, tint: "bg-sky-100 text-sky-700" },
              { icon: Eye, label: "Completion", value: completionRate, suffix: "%", tint: "bg-emerald-100 text-emerald-700" },
            ]
          : activeRole === "Project Manager"
            ? [
                { icon: FolderKanban, label: "Projects", value: totalProjects, tint: "bg-violet-100 text-violet-700" },
                { icon: UsersRound, label: "Teams", value: teams?.length ?? 0, tint: "bg-indigo-100 text-indigo-700" },
                { icon: Activity, label: "In Progress", value: inProgressTasks, tint: "bg-sky-100 text-sky-700" },
                { icon: Clock, label: "Overdue", value: overdueTasks, tint: "bg-rose-100 text-rose-700" },
              ]
            : [
                { icon: FolderKanban, label: "Projects", value: totalProjects, tint: "bg-violet-100 text-violet-700" },
                { icon: CheckSquare, label: "Tasks", value: totalTasks, tint: "bg-sky-100 text-sky-700" },
                { icon: Clock, label: "Overdue", value: overdueTasks, tint: "bg-rose-100 text-rose-700" },
                { icon: UsersRound, label: "Teams", value: teams?.length ?? 0, tint: "bg-indigo-100 text-indigo-700" },
              ];
  const recentProjects = [...(projects ?? [])].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 5);
  const downloadSharedResource = async (resourceId: string, filename: string) => {
    try { await documentsApi.download(resourceId, filename); }
    catch (error) { toast.error(getApiErrorMessage(error)); }
  };

  return (
    <div className="workspace-page animate-enter !space-y-4">
      <section className="relative isolate flex flex-col justify-between gap-4 overflow-hidden rounded-3xl bg-gradient-to-br from-[#302c83] via-[#5146d9] to-[#7868f8] px-5 py-5 text-white shadow-xl shadow-indigo-900/15 sm:flex-row sm:items-center sm:px-7 sm:py-6">
        <div className="pointer-events-none absolute -right-12 -top-28 -z-10 h-80 w-80 rounded-full border-[42px] border-white/[0.07]" />
        <div className="pointer-events-none absolute -bottom-44 right-40 -z-10 h-72 w-72 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="min-w-0">
          <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-100"><Sparkles className="h-3.5 w-3.5" /> Your project command center</p>
          <h1 className="break-words text-xl font-bold tracking-tight sm:text-2xl">Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""} <span aria-hidden="true">✦</span></h1>
          <p className="mt-1.5 max-w-lg text-xs text-violet-100/90 sm:text-sm">A clear view of the work in motion, what needs attention, and where your team is headed.</p>
        </div>
        <Button asChild variant="secondary" className="relative z-10 shrink-0 bg-white text-indigo-700 shadow-lg hover:bg-violet-50"><Link href="/projects">Explore projects <ArrowRight className="h-4 w-4" /></Link></Button>
      </section>

      <Card className="min-w-0 border-white/90">
        <CardContent className="flex min-w-0 flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">Quick actions</h2>
            <p className="mt-1 text-xs text-slate-500">Start common work from one place. Actions follow your assigned permissions.</p>
          </div>
          <div className="flex min-w-0 flex-wrap gap-2">
            {permissionsLoading ? <Skeleton className="h-10 w-36" /> : <>
              {canManageProjects && <Button size="sm" onClick={() => setProjectDialogOpen(true)}><Plus className="h-4 w-4" /> New project</Button>}
              {canManageTasks && <Button size="sm" variant="outline" onClick={() => setTaskDialogOpen(true)}><CheckSquare className="h-4 w-4" /> Create task</Button>}
              {canManageTeams && <Button size="sm" variant="outline" onClick={() => setTeamDialogOpen(true)}><UsersRound className="h-4 w-4" /> Create team</Button>}
              {canManageUsers && <Button size="sm" variant="outline" onClick={() => setEmployeeDialogOpen(true)}><UserPlus className="h-4 w-4" /> Add employee</Button>}
              {!canManageProjects && !canManageTasks && !canManageTeams && !canManageUsers && <p className="self-center text-xs text-slate-500">You can work on assigned tasks and explore your project workspace.</p>}
            </>}
          </div>
        </CardContent>
      </Card>

      {showSharedResources && <Card className="min-w-0 overflow-hidden border-white/90">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0 flex-1"><CardTitle className="text-base">Shared project resources</CardTitle><p className="mt-1 text-xs text-slate-500">Files and links shared with your delivery roles.</p></div>
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
            {activeRole === "Tester" ? <ClipboardCheck className="h-5 w-5" /> : activeRole === "Viewer" ? <Eye className="h-5 w-5" /> : <Activity className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-600">{permissionsLoading ? "Your workspace" : roleDashboard?.role ?? "Your workspace"}</p>
            <h2 className="mt-1 text-base font-semibold text-slate-900">{permissionsLoading ? "Loading your role view" : roleDashboard?.title ?? "Workspace overview"}</h2>
            <p className="mt-1 text-sm text-slate-600">{permissionsLoading ? "Your dashboard is loading based on your assigned access." : roleDashboard?.description ?? "Your available actions follow your assigned permissions."}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {roleStats.map((stat) => (
          <StatCard key={stat.label} icon={stat.icon} label={stat.label} value={stat.value} isLoading={tasksLoading || !teams || !projects} href={stat.label.includes("Team") ? "/teams" : stat.label.includes("Project") ? "/projects" : "/tasks"} tint={stat.tint} />
        ))}
        {canManageUsers && <StatCard icon={UserPlus} label="Employees" value={employees?.length ?? 0} isLoading={!employees} href="/users" tint="bg-amber-100 text-amber-700" />}
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
        <Card className="min-w-0 overflow-hidden border-white/90">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
            <div className="min-w-0 flex-1"><CardTitle className="text-base">Recent projects</CardTitle><p className="mt-1 text-xs text-slate-500">Latest updates from your workspace</p></div>
            <Link href="/projects" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-violet-700 hover:text-violet-900">View all <ArrowRight className="h-3.5 w-3.5" /></Link>
          </CardHeader>
          <CardContent className="space-y-2 p-4">
            {projectsLoading ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />) : recentProjects.length === 0 ? (
              <div className="py-8 text-center"><FolderKanban className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 text-sm font-medium text-slate-700">No projects yet</p><p className="mt-1 text-xs text-slate-500">Create a project to start organizing work.</p></div>
            ) : recentProjects.map((project) => (
              <Link key={project.project_id} href="/projects" className="group flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-transparent bg-white p-3 transition hover:border-violet-100 hover:bg-violet-50/40 sm:flex-nowrap">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-sky-100 text-violet-700"><FolderKanban className="h-4 w-4" /></div>
                  <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{project.project_name}</p><p className="mt-1 text-[11px] text-slate-500">Updated {formatDate(project.updated_at)}</p></div>
                </div>
                <div className="flex shrink-0 items-center gap-2"><ProjectStatusBadge status={project.status} /><ArrowRight className="hidden h-4 w-4 text-violet-400 transition group-hover:translate-x-0.5 sm:block" /></div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden border-white/90">
          <CardHeader className="flex flex-row items-center gap-3 border-b border-slate-100 px-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700"><Activity className="h-5 w-5" /></div>
            <div><CardTitle className="text-base">Delivery pulse</CardTitle><p className="mt-1 text-xs text-slate-500">Task progress at a glance</p></div>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs font-medium text-slate-500">Completion rate</p><p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{completionRate}<span className="text-lg text-slate-400">%</span></p></div><div className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">{completedTasks} done</div></div>
            <Progress value={completionRate} className="h-2.5 bg-slate-100 [&>div]:bg-gradient-to-r [&>div]:from-violet-500 [&>div]:to-indigo-400" />
            <div className="space-y-3">
              {[{ label: "In progress", count: inProgressTasks, color: "bg-sky-500" }, { label: "In review", count: reviewTasks, color: "bg-amber-500" }, { label: "To do", count: todoTasks, color: "bg-slate-400" }].map((item) => <div key={item.label} className="flex items-center gap-3"><div className={`h-2 w-2 rounded-full ${item.color}`} /><span className="flex-1 text-xs font-medium text-slate-600">{item.label}</span><span className="text-xs font-semibold text-slate-800">{item.count}</span><span className="w-9 text-right text-[10px] text-slate-400">{totalTasks ? Math.round((item.count / totalTasks) * 100) : 0}%</span></div>)}
            </div>
            <Link href="/calendar" className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-3 text-xs font-semibold text-slate-700 transition hover:bg-violet-50 hover:text-violet-700"><span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Open team calendar</span><ArrowRight className="h-3.5 w-3.5" /></Link>
          </CardContent>
        </Card>
      </div>

      {canManageProjects && <ProjectFormDialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen} />}
      {canManageTasks && <TaskFormDialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen} />}
      {canManageTeams && <TeamFormDialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen} />}
      {canManageUsers && <UserFormDialog open={employeeDialogOpen} onOpenChange={setEmployeeDialogOpen} />}
    </div>
  );
}
