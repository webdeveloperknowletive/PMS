"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CheckSquare, Clock, KanbanSquare, MessageCircle, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/shared/empty-state";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { TaskFormDialog } from "@/components/modules/tasks/task-form-dialog";
import { KanbanColumn, type KanbanCardData } from "@/components/modules/kanban/kanban-column";
import { AddTaskToColumnDialog } from "@/components/modules/kanban/add-task-to-column-dialog";
import { useTasks, useSprints, useSprintReport, useUpdateSprint, useUpdateTask, useStartWorkSession, useTaskWorkTimes, useWorkSessions } from "@/hooks/queries/use-tasks";
import { useProjectReleases } from "@/hooks/queries/use-projects";
import { useUsers } from "@/hooks/queries/use-users";
import { useTeamMemberCandidates } from "@/hooks/queries/use-teams";
import { isDeveloperOrTester, visibleMemberPostForRoleNames } from "@/lib/member-visibility";
import { useCreateKanbanColumn, useKanbanColumns, useKanbanTaskPlacements, useMoveKanbanTask } from "@/hooks/queries/use-kanban";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuthStore } from "@/store/auth-store";
import { canUpdateTask } from "@/lib/permissions";
import { COLUMN_NAME_TO_STATUS, DEFAULT_COLUMN_COLORS, DEFAULT_COLUMN_NAMES, TASK_STATUS_LABEL } from "@/lib/constants";
import { TaskStatusBadge } from "@/components/shared/status-badge";
import { formatDate } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/api/client";
import type { Task } from "@/types/task";
import { AddColumnDialog } from "@/components/modules/kanban/add-column-dialog";
import { SprintFormDialog } from "@/components/modules/tasks/sprint-form-dialog";
import { TaskActivityDialog } from "@/components/modules/tasks/task-activity-dialog";
import type { Sprint } from "@/types/task";

export function ProjectWorkPanel({ projectId }: { projectId: string }) {
  const { canManageTasks, canManageKanbanBoard, canMoveKanbanCard, permissionCodes } = usePermissions();
  const canViewTeamMembers = ["teams.view", "teams.manage", "teams.members.manage"].some((code) => permissionCodes.includes(code));
  const { data: allTasks = [] } = useTasks({ limit: 500 });
  const { data: users = [] } = useUsers();
  const { data: teamMemberCandidates = [] } = useTeamMemberCandidates(canViewTeamMembers);
  const { data: allColumns = [] } = useKanbanColumns();
  const { data: placements = [] } = useKanbanTaskPlacements();
  const { data: sprints = [] } = useSprints(projectId);
  const { data: releases = [] } = useProjectReleases(projectId);
  const { data: workSessions = [] } = useWorkSessions();
  const { data: workTimes = [] } = useTaskWorkTimes();
  const currentUser = useAuthStore((state) => state.user);
  const updateTask = useUpdateTask();
  const updateSprint = useUpdateSprint();
  const moveTask = useMoveKanbanTask();
  const createColumn = useCreateKanbanColumn();
  const startWork = useStartWorkSession();
  const [tab, setTab] = useState("board");
  const [search, setSearch] = useState("");
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [addTaskColumnId, setAddTaskColumnId] = useState<string | null>(null);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [seedingBoard, setSeedingBoard] = useState(false);
  const [sprintFormOpen, setSprintFormOpen] = useState(false);
  const [selectedSprintId, setSelectedSprintId] = useState("__backlog__");
  const [backlogGroupBy, setBacklogGroupBy] = useState<"none" | "epic" | "release">("none");
  const [activityTask, setActivityTask] = useState<Task | null>(null);
  const [clockNow, setClockNow] = useState(Date.now());
  const taskWorkTimes = useMemo(() => new Map(workTimes.map((item) => [item.task_id, item])), [workTimes]);
  const assigneeOptions = useMemo(() => {
    const options = new Map<string, { user_id: string; name: string; role_names: string[] }>();
    users.filter(isDeveloperOrTester).forEach((user) => options.set(user.user_id, { user_id: user.user_id, name: user.name, role_names: user.role_names ?? [] }));
    teamMemberCandidates.forEach((user) => options.set(user.user_id, { user_id: user.user_id, name: user.name, role_names: user.role_names ?? [] }));
    return [...options.values()];
  }, [users, teamMemberCandidates]);
  const hasTrackingTasks = workTimes.some((item) => item.is_tracking);
  useEffect(() => {
    if (!hasTrackingTasks) return;
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasTrackingTasks]);

  const tasks = useMemo(() => allTasks.filter((task) => task.project_id === projectId), [allTasks, projectId]);
  const columns = useMemo(() => allColumns.filter((column) => column.project_id === projectId).sort((a, b) => a.position - b.position), [allColumns, projectId]);
  const taskMap = useMemo(() => new Map(tasks.map((task) => [task.task_id, task])), [tasks]);
  const cardsByColumn = useMemo(() => {
    const grouped = new Map<string, KanbanCardData[]>(columns.map((column) => [column.column_id, []]));
    for (const placement of placements) {
      const task = taskMap.get(placement.task_id);
      const columnCards = grouped.get(placement.column_id);
      if (task && columnCards) columnCards.push({ placementId: placement.kanban_task_id, task });
    }
    for (const [columnId, cards] of grouped) {
      const order = new Map(placements.filter((item) => item.column_id === columnId).map((item) => [item.kanban_task_id, item.position]));
      cards.sort((a, b) => (order.get(a.placementId) ?? 0) - (order.get(b.placementId) ?? 0));
    }
    return grouped;
  }, [columns, placements, taskMap]);
  const placedIds = useMemo(() => new Set(placements.filter((item) => taskMap.has(item.task_id)).map((item) => item.task_id)), [placements, taskMap]);
  const unplacedTasks = tasks.filter((task) => !placedIds.has(task.task_id));
  const filteredTasks = tasks.filter((task) => task.task_name.toLowerCase().includes(search.toLowerCase()) || (task.description ?? "").toLowerCase().includes(search.toLowerCase()));
  const selectedColumn = columns.find((column) => column.column_id === addTaskColumnId);
  const selectedSprint = sprints.find((sprint) => sprint.sprint_id === selectedSprintId);
  const { data: sprintReport, isLoading: sprintReportLoading, isError: sprintReportError } = useSprintReport(selectedSprint?.sprint_id);
  const velocityMax = Math.max(1, ...(sprintReport?.velocity_history.map((item) => item.delivered_points) ?? []));
  const cumulativeFlowData = sprintReport?.burndown.map((point) => ({ date: point.date, ...point.status_counts })) ?? [];
  const activeWorkSession = workSessions.find((session) => session.user_id === currentUser?.user_id && session.is_running);
  const activeTaskIds = new Set(activeWorkSession?.task_ids ?? []);
  const backlogTasks = tasks.filter((task) => selectedSprintId === "__backlog__" ? !task.sprint_id : task.sprint_id === selectedSprintId);
  const backlogGroups = useMemo(() => {
    const groups = new Map<string, Task[]>();
    const releaseNames = new Map(releases.map((release) => [release.release_id, release.name]));
    for (const task of backlogTasks) {
      let groupName = "";
      if (backlogGroupBy === "epic") {
        const parent = task.task_type === "EPIC" ? task : task.parent_task_id ? taskMap.get(task.parent_task_id) : undefined;
        groupName = parent?.task_type === "EPIC" ? parent.task_name : "No epic";
      } else if (backlogGroupBy === "release") {
        groupName = task.release_id ? releaseNames.get(task.release_id) ?? "No release" : "No release";
      }
      groups.set(groupName, [...(groups.get(groupName) ?? []), task]);
    }
    return [...groups.entries()];
  }, [backlogTasks, backlogGroupBy, releases, taskMap]);

  const createBoard = async () => {
    setSeedingBoard(true);
    try {
      for (const [position, name] of DEFAULT_COLUMN_NAMES.entries()) {
        await createColumn.mutateAsync({ project_id: projectId, column_name: name, position, color: DEFAULT_COLUMN_COLORS[name] });
      }
      toast.success("Project board created");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setSeedingBoard(false);
    }
  };

  const onDragEnd = async (result: DropResult) => {
    if (!canMoveKanbanCard) return;
    const { source, destination, draggableId } = result;
    if (!destination || (source.droppableId === destination.droppableId && source.index === destination.index)) return;
    try {
      await moveTask.mutateAsync({ placementId: draggableId, payload: { column_id: destination.droppableId, position: destination.index } });
      const task = [...cardsByColumn.values()].flat().find((card) => card.placementId === draggableId)?.task;
      const target = columns.find((column) => column.column_id === destination.droppableId);
      const mappedStatus = target ? COLUMN_NAME_TO_STATUS[target.column_name] : undefined;
      if (task && mappedStatus === "IN_PROGRESS" && task.status !== mappedStatus && task.user_id === currentUser?.user_id && !activeTaskIds.has(task.task_id)) {
        await startWork.mutateAsync([task.task_id]);
        toast.success("Timer started; the task moved to In Progress");
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  const startTaskWork = async (task: Task) => {
    try {
      await startWork.mutateAsync([task.task_id]);
      toast.success(activeWorkSession ? "Task added to your shared timer" : "Timer started; task moved to In Progress");
    } catch (error) { toast.error(getApiErrorMessage(error)); }
  };

  const moveTaskToSprint = async (task: Task, sprintId: string) => {
    try {
      await updateTask.mutateAsync({ id: task.task_id, payload: { sprint_id: sprintId === "__backlog__" ? null : sprintId } });
      toast.success(sprintId === "__backlog__" ? "Task moved to backlog" : "Task added to sprint");
    } catch (error) { toast.error(getApiErrorMessage(error)); }
  };

  const assignTask = async (task: Task, userId: string) => {
    try {
      await updateTask.mutateAsync({ id: task.task_id, payload: { user_id: userId === "__unassigned__" ? null : userId } });
      toast.success(userId === "__unassigned__" ? "Task unassigned" : "Task assigned");
    } catch (error) { toast.error(getApiErrorMessage(error)); }
  };

  const changeSprintStatus = async (sprint: Sprint, status: Sprint["status"]) => {
    try {
      await updateSprint.mutateAsync({ id: sprint.sprint_id, payload: { status } });
      toast.success(status === "ACTIVE" ? "Sprint started" : "Sprint completed");
    } catch (error) { toast.error(getApiErrorMessage(error)); }
  };

  const renderBacklogTaskRow = (task: Task) => {
    const assignee = assigneeOptions.find((user) => user.user_id === task.user_id);
    const hasAssigneeOption = assigneeOptions.some((user) => user.user_id === task.user_id);
    const assigneeLabel = assignee ? `${assignee.name} (${visibleMemberPostForRoleNames(assignee.role_names)})` : task.assignee_name ?? (task.user_id ? "Assigned member" : "Unassigned");
    return <tr key={task.task_id} className="border-t border-slate-100">
      <td className="px-3 py-2.5"><span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold">{task.task_type ?? "TASK"}</span><span className="font-medium">{task.task_name}</span></td>
      <td className="px-3 py-2.5">{canManageTasks ? <Select value={task.user_id ?? "__unassigned__"} onValueChange={(value) => void assignTask(task, value)}><SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__unassigned__">Unassigned</SelectItem>{task.user_id && !hasAssigneeOption && <SelectItem value={task.user_id}>{assigneeLabel} (current assignee)</SelectItem>}{assigneeOptions.map((user) => <SelectItem key={user.user_id} value={user.user_id}>{user.name} ({visibleMemberPostForRoleNames(user.role_names)})</SelectItem>)}</SelectContent></Select> : <span className="text-xs text-slate-500">{task.user_id ? assigneeLabel : "Unassigned"}</span>}</td>
      <td className="px-3 py-2.5"><PriorityBadge priority={task.priority} /></td>
      <td className="px-3 py-2.5">{task.story_points ?? "—"}</td>
      <td className="px-3 py-2.5">{canManageTasks ? <Select value={task.sprint_id ?? "__backlog__"} onValueChange={(value) => void moveTaskToSprint(task, value)}><SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__backlog__">Backlog</SelectItem>{sprints.filter((sprint) => sprint.status !== "COMPLETED" || sprint.sprint_id === task.sprint_id).map((sprint) => <SelectItem key={sprint.sprint_id} value={sprint.sprint_id}>{sprint.sprint_name}</SelectItem>)}</SelectContent></Select> : <span className="text-xs text-slate-500">{selectedSprint?.sprint_name ?? "Backlog"}</span>}</td>
    </tr>;
  };

  return <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><CheckSquare className="h-4 w-4 text-violet-600" />Project work</h2><p className="mt-1 text-xs text-slate-500">Create, assign, and track this project’s tasks from one place.</p></div>
      {canManageTasks && <Button size="sm" onClick={() => { setEditingTask(null); setTaskDialogOpen(true); }}><Plus className="h-4 w-4" />Create task</Button>}
    </div>
    <Tabs value={tab} onValueChange={setTab}>
      <div className="flex flex-wrap items-center justify-between gap-2"><TabsList><TabsTrigger value="board"><KanbanSquare className="mr-1.5 h-4 w-4" />Board</TabsTrigger><TabsTrigger value="backlog">Backlog &amp; sprints</TabsTrigger><TabsTrigger value="list"><CheckSquare className="mr-1.5 h-4 w-4" />Task list <span className="ml-1 rounded-full bg-slate-200 px-1.5 text-[10px]">{tasks.length}</span></TabsTrigger></TabsList>{tab === "board" && columns.length > 0 && canManageKanbanBoard && <Button size="sm" variant="outline" onClick={() => setAddColumnOpen(true)}><Plus className="h-3.5 w-3.5" />Add column</Button>}{tab === "backlog" && canManageTasks && <Button size="sm" variant="outline" onClick={() => setSprintFormOpen(true)}><Plus className="h-3.5 w-3.5" />Create sprint</Button>}</div>
      <TabsContent value="board" className="mt-3">
        {activeWorkSession && <div className="mb-3 flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5"><div className="flex min-w-0 items-start gap-2"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" /><div className="min-w-0"><p className="text-sm font-semibold text-emerald-900">Timer running automatically</p><p className="truncate text-xs text-emerald-800">{activeWorkSession.task_names.join(" · ")} · Each task’s time saves when it is marked Done.</p></div></div></div>}
        {columns.length ? <DragDropContext onDragEnd={onDragEnd}><div className="flex gap-3 overflow-x-auto pb-3">
          {columns.map((column) => <KanbanColumn key={column.column_id} column={column} cards={cardsByColumn.get(column.column_id) ?? []} userMap={new Map(users.filter(isDeveloperOrTester).map((user) => [user.user_id, user]))} onAddTask={setAddTaskColumnId} canAddTask={canManageTasks} canMoveTask={canMoveKanbanCard} canEditTask={(task) => !!currentUser && canUpdateTask(task.user_id, currentUser.user_id, permissionCodes)} onOpenTaskDetails={setActivityTask} onStartWork={(task) => void startTaskWork(task)} canStartWork={(task) => !!currentUser && task.user_id === currentUser.user_id && !["DONE", "CANCELLED"].includes(task.status) && canUpdateTask(task.user_id, currentUser.user_id, permissionCodes)} activeTaskIds={activeTaskIds} taskWorkTimes={taskWorkTimes} clockNow={clockNow} />)}
        </div></DragDropContext> : <EmptyState icon={KanbanSquare} title="This project board is not set up yet" description={canManageKanbanBoard ? "Create a ready-to-use board here. You can adjust its columns later." : "Ask your Project Manager to set up the board."} actionLabel={canManageKanbanBoard ? (seedingBoard ? "Creating board…" : "Create board") : undefined} onAction={canManageKanbanBoard && !seedingBoard ? () => void createBoard() : undefined} />}
      </TabsContent>
      <TabsContent value="backlog" className="mt-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2"><Select value={selectedSprintId} onValueChange={setSelectedSprintId}><SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__backlog__">Product backlog</SelectItem>{sprints.map((sprint) => <SelectItem key={sprint.sprint_id} value={sprint.sprint_id}>{sprint.sprint_name} · {sprint.status.toLowerCase()}</SelectItem>)}</SelectContent></Select><Select value={backlogGroupBy} onValueChange={(value) => setBacklogGroupBy(value as typeof backlogGroupBy)}><SelectTrigger className="w-40" aria-label="Group backlog by"><SelectValue placeholder="Group by" /></SelectTrigger><SelectContent><SelectItem value="none">No grouping</SelectItem><SelectItem value="epic">Epic</SelectItem><SelectItem value="release">Release</SelectItem></SelectContent></Select>{selectedSprint && <><Badge variant="outline">{selectedSprint.status}</Badge>{canManageTasks && selectedSprint.status === "PLANNED" && <Button size="sm" onClick={() => void changeSprintStatus(selectedSprint, "ACTIVE")}>Start sprint</Button>}{canManageTasks && selectedSprint.status === "ACTIVE" && <Button size="sm" variant="outline" onClick={() => void changeSprintStatus(selectedSprint, "COMPLETED")}>Complete sprint</Button>}</>}</div>
        {selectedSprint?.goal && <p className="rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-800">Sprint goal: {selectedSprint.goal}</p>}
        {selectedSprint && sprintReport && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={`${selectedSprint.sprint_name} summary`}>
          <div className="rounded-xl border border-slate-200 p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs text-slate-500">Tasks completed</span><span className="text-sm font-semibold">{sprintReport.completed_tasks}/{sprintReport.total_tasks}</span></div><Progress value={sprintReport.total_tasks ? sprintReport.completed_tasks / sprintReport.total_tasks * 100 : 0} className="mt-2" /></div>
          <div className="rounded-xl border border-slate-200 p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs text-slate-500">Story points delivered</span><span className="text-sm font-semibold">{sprintReport.completed_points}/{sprintReport.current_scope_points}</span></div><Progress value={sprintReport.current_scope_points ? sprintReport.completed_points / sprintReport.current_scope_points * 100 : 0} className="mt-2" /></div>
          <div className="rounded-xl border border-slate-200 p-3"><span className="text-xs text-slate-500">Remaining work</span><p className="mt-1 text-xl font-semibold text-slate-900">{sprintReport.remaining_tasks} tasks · {sprintReport.remaining_points} pts</p></div>
          <div className="rounded-xl border border-slate-200 p-3"><span className="text-xs text-slate-500">Overdue active tasks</span><p className={`mt-1 text-xl font-semibold ${sprintReport.overdue_tasks ? "text-rose-600" : "text-slate-900"}`}>{sprintReport.overdue_tasks}</p></div>
        </div>}
        {selectedSprint && sprintReport && <div className="grid gap-3 xl:grid-cols-2">
          <section className="min-w-0 rounded-xl border border-slate-200 p-3" aria-label="Sprint burndown report">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-800">Burndown</h3>
              {sprintReport.history_start_date && <span className="text-xs text-slate-500">Tracked from {formatDate(sprintReport.history_start_date)}</span>}
            </div>
            <p className="mt-1 text-xs text-slate-500">Daily remaining story points compared with the ideal line. Completed and cancelled work is excluded from remaining points.</p>
            {sprintReport.burndown_history_available && sprintReport.burndown.length > 0 ? <div className="mt-3 h-56" role="img" aria-label={`Daily remaining story points for ${selectedSprint.sprint_name}`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sprintReport.burndown} margin={{ top: 5, right: 12, bottom: 0, left: -18 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(value: string) => value.slice(5)} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="remaining_points" name="Remaining points" stroke="#7c3aed" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="ideal_points" name="Ideal" stroke="#94a3b8" strokeDasharray="5 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div> : <p className="mt-4 rounded-lg bg-slate-50 px-3 py-4 text-xs text-slate-500">Historical burndown starts when a task baseline is recorded for this sprint.</p>}
          </section>
          <section className="rounded-xl border border-slate-200 p-3" aria-label="Sprint velocity report">
            <h3 className="text-sm font-semibold text-slate-800">Velocity</h3>
            <p className="mt-1 text-xs text-slate-500">
              Average delivered points across up to five recent completed sprints
              {sprintReport.velocity_basis === "MY_ASSIGNED_TASKS" ? " for your assigned tasks" : " in this project"}.
            </p>
            <p className="mt-2 text-2xl font-semibold text-violet-700">
              {sprintReport.average_velocity_points === null ? "—" : `${sprintReport.average_velocity_points} pts`}
            </p>
            {sprintReport.velocity_history.length > 0 ? <ul className="mt-3 space-y-3">
              {sprintReport.velocity_history.map((item) => <li key={item.sprint_id} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs"><span className="truncate text-slate-600">{item.sprint_name}</span><span className="shrink-0 font-semibold text-slate-800">{item.delivered_points} pts</span></div>
                <div className="h-1.5 rounded-full bg-violet-100"><div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.max(3, item.delivered_points / velocityMax * 100)}%` }} /></div>
              </li>)}
            </ul> : <p className="mt-3 rounded-lg bg-slate-50 px-3 py-4 text-xs text-slate-500">Velocity appears after a sprint with recorded scope history is completed.</p>}
          </section>
          <section className="min-w-0 rounded-xl border border-slate-200 p-3" aria-label="Cumulative flow report">
            <h3 className="text-sm font-semibold text-slate-800">Cumulative flow</h3>
            <p className="mt-1 text-xs text-slate-500">Daily task count by status for work still in the sprint scope.</p>
            {sprintReport.burndown_history_available ? <div className="mt-3 h-56" role="img" aria-label={`Daily task counts by status for ${selectedSprint.sprint_name}`}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cumulativeFlowData} margin={{ top: 5, right: 12, bottom: 0, left: -18 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(value: string) => value.slice(5)} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Area type="monotone" dataKey="TODO" stackId="status" stroke="#64748b" fill="#94a3b8" />
                  <Area type="monotone" dataKey="IN_PROGRESS" stackId="status" stroke="#2563eb" fill="#60a5fa" />
                  <Area type="monotone" dataKey="IN_REVIEW" stackId="status" stroke="#d97706" fill="#fbbf24" />
                  <Area type="monotone" dataKey="BLOCKED" stackId="status" stroke="#dc2626" fill="#f87171" />
                  <Area type="monotone" dataKey="DONE" stackId="status" stroke="#16a34a" fill="#4ade80" />
                  <Area type="monotone" dataKey="CANCELLED" stackId="status" stroke="#64748b" fill="#cbd5e1" />
                </AreaChart>
              </ResponsiveContainer>
            </div> : <p className="mt-4 rounded-lg bg-slate-50 px-3 py-4 text-xs text-slate-500">Status history appears after a sprint baseline is recorded.</p>}
          </section>
          <section className="min-w-0 rounded-xl border border-slate-200 p-3" aria-label="Sprint throughput and cycle time">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-800">Throughput &amp; cycle time</h3>
              <span className="text-xs text-slate-500">{sprintReport.total_throughput_tasks} Done transitions</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Done transitions per report interval. Cycle time runs from the latest In Progress entry to Done.</p>
            {sprintReport.burndown_history_available ? <div className="mt-3 h-40" role="img" aria-label={`Throughput by date for ${selectedSprint.sprint_name}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sprintReport.burndown} margin={{ top: 5, right: 12, bottom: 0, left: -18 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(value: string) => value.slice(5)} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="throughput_completed_tasks" name="Done transitions" fill="#7c3aed" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div> : <p className="mt-4 rounded-lg bg-slate-50 px-3 py-4 text-xs text-slate-500">Throughput starts after a sprint baseline is recorded.</p>}
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
              <div><span className="text-slate-500">Average cycle</span><p className="mt-0.5 font-semibold text-slate-800">{sprintReport.average_cycle_time_days === null ? "—" : `${sprintReport.average_cycle_time_days} days`}</p></div>
              <div><span className="text-slate-500">Median cycle</span><p className="mt-0.5 font-semibold text-slate-800">{sprintReport.median_cycle_time_days === null ? "—" : `${sprintReport.median_cycle_time_days} days`}</p></div>
              <p className="col-span-2 text-slate-500">Based on {sprintReport.cycle_time_sample_count} recorded completions.</p>
            </div>
          </section>
        </div>}
        {selectedSprint && sprintReport && <div className="space-y-2 rounded-xl border border-slate-200 p-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600"><span className="font-semibold text-slate-800">Sprint scope history</span>{sprintReport.capacity_points !== null && <span>Capacity: {sprintReport.capacity_points} pts</span>}{sprintReport.original_scope_points !== null && <span>Scope at start: {sprintReport.original_scope_points} pts</span>}<span>Added: {sprintReport.scope_added_points} pts</span><span>Removed: {sprintReport.scope_removed_points} pts</span><span className="text-slate-400">Latest 100 changes</span></div>
          {sprintReport.scope_changes.length > 0 ? <div className="max-h-36 space-y-1 overflow-y-auto">{sprintReport.scope_changes.slice(0, 8).map((change) => <div key={change.scope_change_id} className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500"><span>{new Date(change.created_at).toLocaleString()}</span><span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">{change.event_type.replace("_", " ").toLowerCase()}</span><span>{change.task_name}</span><span>{change.points_before ?? "—"} → {change.points_after ?? "—"} pts</span></div>)}</div> : <p className="text-xs text-slate-500">No scope changes are recorded yet. The starting scope is captured when the sprint begins.</p>}
        </div>}
        {selectedSprint && sprintReportLoading && <p className="text-xs text-slate-500">Loading sprint summary…</p>}
        {selectedSprint && sprintReportError && <p role="alert" className="text-xs text-rose-600">Could not load this sprint summary.</p>}
        {backlogTasks.length ? <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2.5">Work item</th><th className="px-3 py-2.5">Assignee</th><th className="px-3 py-2.5">Priority</th><th className="px-3 py-2.5">Points</th><th className="px-3 py-2.5">Sprint</th></tr></thead><tbody>{backlogGroups.map(([groupName, groupTasks]) => <Fragment key={backlogGroupBy === "none" ? "all-work" : groupName}>{backlogGroupBy !== "none" && <tr className="border-t border-slate-200 bg-slate-50"><th colSpan={5} className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">{groupName} <span className="ml-1 font-normal">({groupTasks.length})</span></th></tr>}{groupTasks.map(renderBacklogTaskRow)}</Fragment>)}</tbody></table></div> : <EmptyState icon={CheckSquare} title={selectedSprint ? "No work in this sprint" : "Backlog is empty"} description={canManageTasks ? "Create a task or move existing work into this sprint." : "There is no work planned here yet."} />}
      </TabsContent>
      <TabsContent value="list" className="mt-3 space-y-3">
        <div className="relative max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search this project’s tasks" className="pl-9" /></div>
        {filteredTasks.length ? <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2.5">Task</th><th className="px-3 py-2.5">Assignee</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Priority</th><th className="px-3 py-2.5">Due date</th><th className="px-3 py-2.5">Actions</th></tr></thead><tbody>{filteredTasks.map((task) => { const canEdit = !!currentUser && canUpdateTask(task.user_id, currentUser.user_id, permissionCodes); const assignee = assigneeOptions.find((user) => user.user_id === task.user_id); const assigneeName = assignee?.name ?? task.assignee_name ?? (task.user_id ? "Assigned member" : "Unassigned"); const assigneeRole = assignee ? ` (${visibleMemberPostForRoleNames(assignee.role_names)})` : ""; return <tr key={task.task_id} className="border-t border-slate-100"><td className="max-w-[280px] px-3 py-2.5"><span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold">{task.task_type ?? "TASK"}</span><span className="font-medium text-slate-800">{task.task_name}</span>{task.description && <p className="truncate text-xs text-slate-500">{task.description}</p>}</td><td className="px-3 py-2.5 text-slate-600">{task.user_id ? `${assigneeName}${assigneeRole}` : "Unassigned"}</td><td className="px-3 py-2.5"><TaskStatusBadge status={task.status} /></td><td className="px-3 py-2.5"><PriorityBadge priority={task.priority} /></td><td className="px-3 py-2.5 text-slate-600">{task.due_date ? formatDate(task.due_date) : "—"}</td><td className="px-3 py-2.5"><div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setActivityTask(task)} title="Comments and history"><MessageCircle className="h-4 w-4" /></Button>{canEdit && <Button variant="outline" size="sm" onClick={() => { setEditingTask(task); setTaskDialogOpen(true); }}>Edit / assign</Button>}</div></td></tr>; })}</tbody></table></div> : <EmptyState icon={CheckSquare} title={search ? "No tasks match" : "No tasks in this project yet"} description={search ? "Try another task name." : "Create a task here and assign it to a teammate."} actionLabel={!search && canManageTasks ? "Create task" : undefined} onAction={!search && canManageTasks ? () => { setEditingTask(null); setTaskDialogOpen(true); } : undefined} />}
      </TabsContent>
    </Tabs>
    <TaskFormDialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen} task={editingTask} defaultProjectId={projectId} />
    {canManageKanbanBoard && <AddColumnDialog open={addColumnOpen} onOpenChange={setAddColumnOpen} projectId={projectId} nextPosition={columns.length} />}
    {canManageTasks && <SprintFormDialog open={sprintFormOpen} onOpenChange={setSprintFormOpen} projectId={projectId} />}
    <AddTaskToColumnDialog open={!!addTaskColumnId} onOpenChange={(open) => !open && setAddTaskColumnId(null)} columnId={addTaskColumnId} columnName={selectedColumn?.column_name} projectId={projectId} unplacedTasks={unplacedTasks} nextPosition={addTaskColumnId ? cardsByColumn.get(addTaskColumnId)?.length ?? 0 : 0} canCreateTask={canManageTasks} canAttachExisting={canManageKanbanBoard} />
    <TaskActivityDialog task={activityTask} open={!!activityTask} onOpenChange={(open) => !open && setActivityTask(null)} canComment={!!currentUser && canUpdateTask(activityTask?.user_id, currentUser.user_id, permissionCodes)} />
  </section>;
}
