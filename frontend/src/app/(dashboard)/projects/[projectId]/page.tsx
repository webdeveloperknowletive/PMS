"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, BarChart3, CalendarDays, CheckSquare, FileText, FolderKanban, GanttChartSquare, PackageCheck, Pencil, Plus, Settings2, Target, Users, Workflow as WorkflowIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { InlineDetailField } from "@/components/shared/inline-detail-field";
import { InlineMultiSelectField } from "@/components/shared/inline-multi-select-field";
import { ProjectStatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProject, useProjectAssignment, useProjectAssignmentCandidates, useProjectComponents, useProjectCustomFields, useProjectGoals, useProjectReleases, useUpdateProject } from "@/hooks/queries/use-projects";
import { useTeams, useTeamLeads } from "@/hooks/queries/use-teams";
import { useTasks } from "@/hooks/queries/use-tasks";
import { useWorkflows } from "@/hooks/queries/use-workflows";
import { useMilestones } from "@/hooks/queries/use-milestones";
import { useCalendarEvents } from "@/hooks/queries/use-calendar";
import { useAllRoleAssignments, useRoles } from "@/hooks/queries/use-roles";
import { useGanttTasks } from "@/hooks/queries/use-gantt";
import { useReports } from "@/hooks/queries/use-reports";
import { useProjectDocuments } from "@/hooks/queries/use-documents";
import { documentsApi } from "@/lib/api/documents";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/api/client";
import { ProjectWorkPanel } from "@/components/modules/projects/project-work-panel";
import { ProjectGoalsPanel } from "@/components/modules/projects/project-goals-panel";
import { ProjectReleasesPanel } from "@/components/modules/projects/project-releases-panel";
import { ProjectComponentsPanel } from "@/components/modules/projects/project-components-panel";
import { ProjectCustomFieldsPanel } from "@/components/modules/projects/project-custom-fields-panel";
import { EventFormDialog } from "@/components/modules/calendar/event-form-dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { CalendarEvent } from "@/types/calendar";
import { usePermissions } from "@/hooks/use-permissions";
import { formatDate } from "@/lib/utils";
import { isDeveloperOrTesterRoleNames, isTeamLeadOnlyRoleNames, visibleMemberPostForRoleNames } from "@/lib/member-visibility";
import { PROJECT_STATUSES, TASK_PRIORITIES } from "@/lib/constants";
import type { ProjectUpdate } from "@/types/project";

function ProjectSection({ title, icon: Icon, count, action, children }: {
  title: string; icon: typeof FolderKanban; count: number; action?: ReactNode; children: React.ReactNode; id?: string;
}) {
  return <Card className="min-w-0 border-white/90">
    <CardHeader className="flex flex-row items-center gap-3 border-b border-slate-100 px-4 py-3.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><Icon className="h-4 w-4" /></span>
      <CardTitle className="min-w-0 flex-1 text-sm">{title}</CardTitle>
      <Badge variant="secondary">{count}</Badge>
      {action}
    </CardHeader>
    <CardContent className="space-y-2 p-4">{children}</CardContent>
  </Card>;
}

function EmptyList({ label }: { label: string }) {
  return <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">No {label} are linked to this project yet.</p>;
}

const PROJECT_VIEWS = {
  "project-overview": "overview",
  "project-work": "backlog",
  "project-board": "board",
  "project-releases": "releases",
  "project-goals": "goals",
  "project-schedule": "schedule",
  "project-reports": "reports",
  "project-components": "components",
  "project-custom-fields": "custom-fields",
  "project-teams": "teams",
  "project-workflows": "workflows",
  "project-milestones": "milestones",
  "project-documents": "documents",
} as const;
type ProjectView = (typeof PROJECT_VIEWS)[keyof typeof PROJECT_VIEWS];
const hashForView = (view: ProjectView) =>
  Object.entries(PROJECT_VIEWS).find(([, value]) => value === view)?.[0] ?? "project-overview";

export default function ProjectWorkspacePage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const { permissionCodes, canCreateEvent } = usePermissions();
  const isAdmin = permissionCodes.includes("roles.manage");
  const canManageEvents = permissionCodes.includes("calendar.manage");
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [activeView, setActiveView] = useState<ProjectView>("overview");
  useEffect(() => {
    const syncView = () => {
      const hash = window.location.hash.slice(1) as keyof typeof PROJECT_VIEWS;
      setActiveView(PROJECT_VIEWS[hash] ?? "overview");
    };
    syncView();
    window.addEventListener("hashchange", syncView);
    return () => window.removeEventListener("hashchange", syncView);
  }, [projectId]);
  const showView = (view: ProjectView) => {
    setActiveView(view);
    window.history.replaceState(window.history.state, "", `#${hashForView(view)}`);
  };
  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const { data: assignment } = useProjectAssignment(projectId);
  const { data: assignmentCandidates = [] } = useProjectAssignmentCandidates(permissionCodes.includes("projects.update") || permissionCodes.includes("roles.manage"));
  const updateProject = useUpdateProject();
  const { data: projectGoals = [] } = useProjectGoals(projectId);
  const { data: projectReleases = [] } = useProjectReleases(projectId);
  const { data: projectComponents = [] } = useProjectComponents(projectId);
  const { data: projectCustomFields = [] } = useProjectCustomFields(projectId);
  const { data: teams = [] } = useTeams();
  const { data: leads = [] } = useTeamLeads();
  const { data: tasks = [] } = useTasks({ limit: 500 });
  const { data: workflows = [] } = useWorkflows();
  const { data: milestones = [] } = useMilestones();
  const { data: events = [] } = useCalendarEvents();
  const { data: roleAssignments = [] } = useAllRoleAssignments();
  const { data: roles = [] } = useRoles();
  const { data: ganttTasks = [] } = useGanttTasks();
  const { data: reports = [] } = useReports();
  const { data: documents = [] } = useProjectDocuments(projectId);

  const projectTeams = teams.filter((item) => item.project_id === projectId);
  const projectTasks = tasks.filter((item) => item.project_id === projectId);
  const projectWorkflows = workflows.filter((item) => item.project_id === projectId);
  const projectMilestones = milestones.filter((item) => item.project_id === projectId);
  const projectEvents = events.filter((item) => item.project_id === projectId && item.calendar_scope === "ORGANIZATION" && !item.is_automatic);
  const projectGanttTasks = ganttTasks.filter((item) => item.project_id === projectId);
  const projectReports = reports.filter((item) => item.project_id === projectId);
  const projectDocuments = documents;
  const users = roleAssignments.map((assignment) => assignment.user);
  const userNames = new Map(users.map((item) => [item.user_id, item.name]));
  const roleNameById = new Map(roles.map((role) => [role.role_id, role.role_name]));
  const userRoles = new Map(roleAssignments.map((assignment) => [assignment.user.user_id, assignment.roles.map((role) => roleNameById.get(role.role_id)).filter((name): name is string => !!name)]));
  const leadUserIds = new Map(leads.map((item) => [item.team_lead_id, item.user_id]));
  const taskNames = new Map(projectTasks.map((item) => [item.task_id, item.task_name]));
  const projectMemberIds = new Set(projectTeams.flatMap((team) => team.members?.map((member) => member.user_id) ?? []));
  const projectLeads = [...new Set(projectTeams.flatMap((team) => { const leadUserId = leads.find((lead) => lead.team_lead_id === team.team_lead_id)?.user_id; return leadUserId ? [userNames.get(leadUserId)].filter((name): name is string => !!name) : []; }))];
  const canEditProject = permissionCodes.includes("projects.update");
  const saveProject = async (payload: ProjectUpdate) => { await updateProject.mutateAsync({ id: projectId, payload }); toast.success("Project updated"); };

  return <div className="workspace-page animate-enter !space-y-5">
    <PageHeader title={projectLoading ? "Loading project…" : project?.project_name ?? "Project not found"} description={project ? `${project.project_key} · Project delivery workspace` : "This page keeps this project’s delivery information together."} actions={<>{permissionCodes.includes("modules.kanban.access") && <Button variant="outline" disabled={!project} onClick={() => showView("board")}><FolderKanban className="h-4 w-4" /> Project Kanban</Button>}<Button asChild variant="outline"><Link href="/projects"><ArrowLeft className="h-4 w-4" /> All projects</Link></Button></>} />
    {project && <nav aria-label="Project views" className="flex gap-1 overflow-x-auto border-b border-[#dfe1e6] text-sm">
      {([ ["overview", "Overview"], ["backlog", "Backlog & sprints"], ["board", "Board"], ["releases", "Releases"], ["goals", "Goals"], ["schedule", "Schedule"], ["reports", "Reports"] ] as const)
        .filter(([view]) => view !== "board" || permissionCodes.includes("modules.kanban.access"))
        .map(([view, label]) => <button key={view} type="button" onClick={() => showView(view)} aria-current={activeView === view ? "page" : undefined} className={`shrink-0 border-b-2 px-3 py-2 text-sm ${activeView === view ? "border-[#0c66e4] font-semibold text-[#0c66e4]" : "border-transparent text-[#44546f] hover:border-[#0c66e4] hover:text-[#0c66e4]"}`}>{label}</button>)}
    </nav>}
    {projectLoading ? <Skeleton className="h-24 w-full" /> : !project ? <Card><CardContent className="p-6 text-sm text-slate-600">This project could not be found.</CardContent></Card> : <>
      {activeView === "overview" && <>
      <Card className="border-[#dfe1e6] bg-[#f7f8f9]"><CardContent className="flex flex-wrap items-center justify-between gap-4 p-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Project status</p><div className="mt-2 flex flex-wrap items-center gap-2"><ProjectStatusBadge status={project.status} /><Badge variant="secondary">{project.priority} priority</Badge></div></div><div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500"><span>Registered {formatDate(project.created_at)}</span><span>Starts {project.start_date ? formatDate(project.start_date) : "Not set"}</span><span>End date {project.due_date ? formatDate(project.due_date) : "Not set"}</span><span>Updated {formatDate(project.updated_at)}</span></div></CardContent></Card>
      <Card className="border-[#dfe1e6] bg-white"><CardHeader><CardTitle className="text-base">Project details</CardTitle></CardHeader><CardContent className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <InlineDetailField label="Name" value={project.project_name} canEdit={canEditProject} required onSave={(value) => saveProject({ project_name: value })} />
        <InlineDetailField label="Status" value={project.status} canEdit={canEditProject} type="select" options={PROJECT_STATUSES.map((value) => ({ value, label: value }))} onSave={(value) => saveProject({ status: value as ProjectUpdate["status"] })} />
        <InlineDetailField label="Priority" value={project.priority} canEdit={canEditProject} type="select" options={TASK_PRIORITIES.map((value) => ({ value, label: value }))} onSave={(value) => saveProject({ priority: value as ProjectUpdate["priority"] })} />
        <InlineDetailField label="Team lead" value={assignment?.team_lead_user_id} canEdit={canEditProject} type="select" options={assignmentCandidates.filter((user) => user.is_active && user.role_names.some((role) => role.toLowerCase() === "team lead")).map((user) => ({ value: user.user_id, label: user.name }))} display={assignmentCandidates.find((user) => user.user_id === assignment?.team_lead_user_id)?.name} onSave={(value) => saveProject({ team_lead_user_id: value })} />
        <InlineMultiSelectField label="Team members" values={assignment?.team_member_user_ids ?? []} options={assignmentCandidates.filter((user) => user.is_active && user.role_names.some((role) => role.toLowerCase() === "developer")).map((user) => ({ value: user.user_id, label: user.name }))} canEdit={canEditProject} onSave={(values) => saveProject({ team_member_user_ids: values })} />
        <InlineDetailField label="Start date" value={project.start_date} canEdit={canEditProject} type="date" onSave={(value) => saveProject({ start_date: value || null })} />
        <InlineDetailField label="Due date" value={project.due_date} canEdit={canEditProject} type="date" onSave={(value) => saveProject({ due_date: value || null })} />
        <InlineDetailField label="Description" value={project.description} canEdit={canEditProject} type="textarea" placeholder="Add a description" onSave={(value) => saveProject({ description: value || null })} className="sm:col-span-2" />
      </CardContent></Card>
      <Card className="border-white/90"><CardContent className="grid gap-4 p-4 sm:grid-cols-2"><div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Project leads</p><p className="mt-1 text-sm font-semibold text-slate-800">{projectLeads.length ? projectLeads.join(", ") : "Not assigned"}</p><p className="mt-1 text-[11px] text-slate-500">Leads are shown from the project’s assigned teams.</p></div><div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Team members</p><p className="mt-1 text-sm font-semibold text-slate-800">{projectMemberIds.size} across {projectTeams.length} {projectTeams.length === 1 ? "team" : "teams"}</p></div></CardContent></Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: CheckSquare, label: "Tasks", count: projectTasks.length, target: "#project-work" },
          { icon: Target, label: "Goals", count: projectGoals.length, target: "#project-goals" },
          { icon: PackageCheck, label: "Releases", count: projectReleases.length, target: "#project-releases" },
          { icon: FolderKanban, label: "Components", count: projectComponents.length, target: "#project-components" },
          { icon: Settings2, label: "Custom fields", count: projectCustomFields.length, target: "#project-custom-fields" },
          { icon: Users, label: "Teams", count: projectTeams.length, target: "#project-teams" },
          { icon: WorkflowIcon, label: "Workflows", count: projectWorkflows.length, target: "#project-workflows" },
          { icon: FolderKanban, label: "Milestones", count: projectMilestones.length, target: "#project-milestones" },
          { icon: FileText, label: "Documents", count: projectDocuments.length, target: "#project-documents" },
        ].map(({ icon: Icon, label, count, target }) => <button key={label} type="button" onClick={() => showView(PROJECT_VIEWS[target.slice(1) as keyof typeof PROJECT_VIEWS])} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"><Card className="h-full transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md"><CardContent className="flex items-center gap-3 p-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><Icon className="h-5 w-5" /></span><div><p className="text-xs text-slate-500">{label} · open details</p><p className="text-xl font-bold text-slate-900">{count}</p></div></CardContent></Card></button>)}
      </div>
      </>}
      {activeView === "goals" && <ProjectGoalsPanel projectId={projectId} />}
      {activeView === "releases" && <ProjectReleasesPanel projectId={projectId} />}
      {activeView === "components" && <ProjectComponentsPanel projectId={projectId} />}
      {activeView === "custom-fields" && <ProjectCustomFieldsPanel projectId={projectId} />}
      {activeView === "backlog" && <ProjectWorkPanel key={`${projectId}-backlog`} projectId={projectId} initialTab="backlog" showTabs={false} />}
      {activeView === "board" && <ProjectWorkPanel key={`${projectId}-board`} projectId={projectId} initialTab="board" showTabs={false} />}
      <div className="grid gap-5 xl:grid-cols-2">
        {(activeView === "overview" || activeView === "teams") && <ProjectSection id="project-teams" title="Teams and members" icon={Users} count={projectTeams.reduce((total, team) => total + (team.members?.length ?? 0), 0)}>{projectTeams.length ? projectTeams.map((team) => { const leadUserId = leadUserIds.get(team.team_lead_id); const leadRoles = leadUserId ? userRoles.get(leadUserId) ?? [] : []; const visibleLeadName = leadUserId && isTeamLeadOnlyRoleNames(leadRoles) ? userNames.get(leadUserId) : null; const visibleTeamMembers = (team.members ?? []).filter((member) => isDeveloperOrTesterRoleNames(userRoles.get(member.user_id) ?? [])); return <div key={team.team_id} className="rounded-xl border border-slate-100 p-3"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold text-slate-800">{team.team_name}</p><Badge variant="outline">{team.status}</Badge></div><p className="mt-1 text-xs text-slate-500">Team lead: {visibleLeadName ? `${visibleLeadName} (Team Lead)` : "Not assigned"}</p><div className="mt-3 space-y-2">{visibleTeamMembers.length ? visibleTeamMembers.map((member) => { const person = users.find((item) => item.user_id === member.user_id); const postNames = userRoles.get(member.user_id) ?? []; return <div key={member.member_id} className="flex items-center gap-2 rounded-lg bg-slate-50 p-2"><UserAvatar user={person} showName={false} size="sm" /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-slate-800">{person?.name ?? "Team member"}{` (${visibleMemberPostForRoleNames(postNames)})`}</span><span className="block truncate text-[10px] text-slate-500">{person?.email ?? ""}{member.responsibility ? ` · ${member.responsibility}` : ""}</span></span></div>; }) : <p className="text-xs text-slate-500">No Developers or Testers in this team.</p>}</div></div>; }) : <EmptyList label="teams" />}<p className="text-[11px] text-slate-400">Edit project membership in the Project details section above.</p></ProjectSection>}
        {(activeView === "overview" || activeView === "workflows") && <ProjectSection id="project-workflows" title="Workflows" icon={WorkflowIcon} count={projectWorkflows.length}>{projectWorkflows.length ? projectWorkflows.map((workflow) => <div key={workflow.workflow_id} className="rounded-xl border border-slate-100 p-3"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold text-slate-800">{workflow.workflow_name}</p><Badge variant="outline">{workflow.status}</Badge></div><p className="mt-1 text-xs text-slate-500">{workflow.workflow_type}{workflow.is_default ? " · Default" : ""}</p></div>) : <EmptyList label="workflows" />}</ProjectSection>}
        {(activeView === "overview" || activeView === "milestones") && <ProjectSection id="project-milestones" title="Milestones" icon={FolderKanban} count={projectMilestones.length}>{projectMilestones.length ? projectMilestones.map((milestone) => <div key={milestone.milestone_id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{milestone.title}</p><p className="mt-1 text-xs text-slate-500">Due {formatDate(milestone.due_date)}</p></div><Badge variant="outline">{milestone.is_completed ? "Complete" : "Open"}</Badge></div>) : <EmptyList label="milestones" />}</ProjectSection>}
        {(activeView === "overview" || activeView === "documents") && <ProjectSection id="project-documents" title="Project documents and resources" icon={FileText} count={projectDocuments.length}>{projectDocuments.length ? projectDocuments.map((document) => <div key={document.document_id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{document.title}</p><p className="mt-1 text-xs text-slate-500">{document.resource_type} · v{document.version} · Added {formatDate(document.created_at)}</p>{document.original_filename && <p className="mt-1 truncate text-[11px] text-slate-400">{document.original_filename}</p>}</div>{document.resource_type === "FILE" ? <Button size="sm" variant="outline" onClick={() => void documentsApi.download(document.document_id, document.original_filename || `${document.title}.file`).catch((error) => toast.error(getApiErrorMessage(error)))}>Download</Button> : document.file_url ? <Button asChild size="sm" variant="outline"><a href={document.file_url} target="_blank" rel="noopener noreferrer">Open resource</a></Button> : null}</div>) : <EmptyList label="documents or resources" />}</ProjectSection>}
        {(activeView === "overview") && <ProjectSection title="Meetings and calendar" icon={CalendarDays} count={projectEvents.length} action={isAdmin && canCreateEvent ? <Button size="sm" onClick={() => { setEditingEvent(null); setEventDialogOpen(true); }}><Plus className="h-4 w-4" /> Add meeting</Button> : undefined}>{projectEvents.length ? projectEvents.map((event) => <button key={event.event_id} type="button" disabled={!isAdmin || !canManageEvents} onClick={() => { setEditingEvent(event); setEventDialogOpen(true); }} className="w-full rounded-xl border border-slate-100 p-3 text-left transition hover:border-violet-200 hover:bg-violet-50/40 disabled:cursor-default disabled:hover:border-slate-100 disabled:hover:bg-white"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold text-slate-800">{event.title}</p>{isAdmin && canManageEvents && <Pencil className="h-3.5 w-3.5 text-slate-400" />}</div><p className="mt-1 text-xs text-slate-500">{event.event_type} · {formatDate(event.start_datetime)} · {event.location || "No location"}</p></button>) : <EmptyList label="meetings or events" />}</ProjectSection>}
        {(activeView === "schedule") && <ProjectSection id="project-schedule" title="Schedule (Gantt)" icon={GanttChartSquare} count={projectGanttTasks.length}>{projectGanttTasks.length ? projectGanttTasks.map((item) => <div key={item.gantt_id} className="rounded-xl border border-slate-100 p-3"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold text-slate-800">{taskNames.get(item.task_id) ?? "Task"}</p><span className="text-xs font-semibold text-violet-700">{item.progress}%</span></div><p className="mt-1 text-xs text-slate-500">{formatDate(item.start_date)} – {formatDate(item.end_date)}</p></div>) : <EmptyList label="scheduled tasks" />}</ProjectSection>}
        {(activeView === "reports") && <ProjectSection id="project-reports" title="Reports" icon={BarChart3} count={projectReports.length}>{projectReports.length ? projectReports.map((report) => <div key={report.report_id} className="rounded-xl border border-slate-100 p-3"><p className="truncate text-sm font-semibold text-slate-800">{report.report_name}</p><p className="mt-1 text-xs text-slate-500">{report.report_type} · {report.report_format} · {report.status}</p></div>) : <EmptyList label="reports" />}</ProjectSection>}
      </div>
    </>}
    <EventFormDialog open={eventDialogOpen} onOpenChange={setEventDialogOpen} event={editingEvent} defaultProjectId={projectId} />
  </div>;
}
