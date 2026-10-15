"use client";

import { useEffect, useMemo, useState } from "react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { Clock, KanbanSquare, Plus, UserRound } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { KanbanColumn } from "@/components/modules/kanban/kanban-column";
import type { KanbanCardData } from "@/components/modules/kanban/kanban-column";
import { AddTaskToColumnDialog } from "@/components/modules/kanban/add-task-to-column-dialog";
import { AddColumnDialog } from "@/components/modules/kanban/add-column-dialog";
import { TaskFormDialog } from "@/components/modules/tasks/task-form-dialog";
import { useProjects } from "@/hooks/queries/use-projects";
import { useDeleteTask, useStartWorkSession, useTasks, useTaskWorkTimes, useWorkSessions, useUpdateTask } from "@/hooks/queries/use-tasks";
import { useUsers } from "@/hooks/queries/use-users";
import { useTeamLeads, useTeams } from "@/hooks/queries/use-teams";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuthStore } from "@/store/auth-store";
import { canUpdateTask } from "@/lib/permissions";
import {
  useCreateKanbanColumn,
  useKanbanColumns,
  useKanbanTaskPlacements,
  useApproveKanbanReview,
  useMoveKanbanTask,
  useCreateKanbanTaskPlacement,
} from "@/hooks/queries/use-kanban";
import { DEFAULT_COLUMN_COLORS, DEFAULT_COLUMN_NAMES, COLUMN_NAME_TO_STATUS } from "@/lib/constants";
import { getApiErrorMessage } from "@/lib/api/client";
import type { Task } from "@/types/task";

export default function KanbanPage() {
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const [projectId, setProjectId] = useState<string>("");

  const { data: columns, isLoading: columnsLoading } = useKanbanColumns();
  const { data: placements, isLoading: placementsLoading } = useKanbanTaskPlacements();
  const { data: tasks } = useTasks({ limit: 500 });
  const { data: workSessions = [] } = useWorkSessions();
  const { data: workTimes = [] } = useTaskWorkTimes();
  const { data: users } = useUsers();
  const { data: teams } = useTeams();
  const { data: teamLeads } = useTeamLeads();
  const { canManageKanbanBoard, canManageTasks, canMoveKanbanCard, permissionCodes } = usePermissions();
  const currentUser = useAuthStore((state) => state.user);
  const isDeveloperDashboard = currentUser?.role_names?.some((role) => role.trim().toLowerCase() === "developer") ?? false;
  const isTeamLead = currentUser?.role_names?.some((role) => role.trim().toLowerCase() === "team lead") ?? false;

  const createColumn = useCreateKanbanColumn();
  const moveTask = useMoveKanbanTask();
  const createTaskPlacement = useCreateKanbanTaskPlacement();
  const approveReview = useApproveKanbanReview();
  const updateTask = useUpdateTask();
  const startWork = useStartWorkSession();
  const deleteTask = useDeleteTask();

  const [addTaskColumnId, setAddTaskColumnId] = useState<string | null>(null);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [approvingReviewTaskId, setApprovingReviewTaskId] = useState<string | null>(null);
  const [approvedReviewTaskIds, setApprovedReviewTaskIds] = useState<Set<string>>(() => new Set());
  const [seedingColumns, setSeedingColumns] = useState(false);
  const [showSelfTasks, setShowSelfTasks] = useState(false);
  // Team Leads create developer tasks in the selected project view. They must
  // not create tasks while viewing their own PM-assigned tasks.
  const canAddTaskToBoard = canManageKanbanBoard && (!isTeamLead || !showSelfTasks);
  useEffect(() => {
    if (isTeamLead && new URLSearchParams(window.location.search).get("view") === "self") {
      setShowSelfTasks(true);
    }
  }, [isTeamLead]);
  const taskWorkTimes = useMemo(() => new Map(workTimes.map((item) => [item.task_id, item])), [workTimes]);

  const currentTeamLeadIds = useMemo(
    () => new Set((teamLeads ?? []).filter((lead) => lead.user_id === currentUser?.user_id).map((lead) => lead.team_lead_id)),
    [teamLeads, currentUser?.user_id],
  );
  const leadTeams = useMemo(
    () => (teams ?? []).filter((team) => currentTeamLeadIds.has(team.team_lead_id)),
    [teams, currentTeamLeadIds],
  );
  // The projects API already scopes its response to projects assigned to the
  // signed-in Team Lead. Avoid intersecting that list with separately loaded
  // Team/TeamLead records, which can be permission-filtered and hide valid
  // projects from the selector.
  const selectableProjects = projects ?? [];

  // Default to a project assigned to this Team Lead (or the first visible project).
  useEffect(() => {
    if (!projectId && selectableProjects.length > 0) setProjectId(selectableProjects[0].project_id);
    else if (projectId && selectableProjects.length > 0 && !selectableProjects.some((project) => project.project_id === projectId)) {
      setProjectId(selectableProjects[0].project_id);
    }
  }, [selectableProjects, projectId]);

  const projectTeams = useMemo(() => leadTeams.filter((team) => team.project_id === projectId), [leadTeams, projectId]);
  const projectTeamIds = useMemo(() => new Set(projectTeams.map((team) => team.team_id)), [projectTeams]);
  const projectMemberIds = useMemo(
    () => new Set(projectTeams.flatMap((team) => (team.members ?? []).map((member) => member.user_id))),
    [projectTeams],
  );

  const userMap = useMemo(() => new Map((users ?? []).map((u) => [u.user_id, u])), [users]);
  const activeWorkSession = workSessions.find((session) => session.user_id === currentUser?.user_id && session.is_running);
  const activeTaskIds = useMemo(() => new Set(activeWorkSession?.task_ids ?? []), [activeWorkSession?.task_ids]);
  const taskMap = useMemo(() => new Map((tasks ?? []).map((t) => [t.task_id, t])), [tasks]);

  const projectColumns = useMemo(
    () => (columns ?? []).filter((c) => c.project_id === projectId).sort((a, b) => a.position - b.position),
    [columns, projectId]
  );

  const addTaskColumn = projectColumns.find((c) => c.column_id === addTaskColumnId);

  const isVisibleTeamMemberTask = (task: Task) => {
    if (!isTeamLead) return true;
    if (showSelfTasks) return task.user_id === currentUser?.user_id;
    if (!task.user_id || task.user_id === currentUser?.user_id) return false;
    const hasLoadedMembers = projectTeams.some((team) => (team.members ?? []).length > 0);
    // Task team links can be missing on older assignments. Prefer explicit
    // membership when available; otherwise use the task's team_id as the
    // project-team association.
    return hasLoadedMembers ? projectMemberIds.has(task.user_id) : projectTeamIds.has(task.team_id ?? "");
  };

  const columnStatus = (columnName: string) => COLUMN_NAME_TO_STATUS[columnName]
    ?? Object.entries(COLUMN_NAME_TO_STATUS).find(([name]) => name.trim().toLowerCase() === columnName.trim().toLowerCase())?.[1];

  const columnForTask = (task: Task) => projectColumns.find((column) => columnStatus(column.column_name) === task.status)
    ?? (task.status === "BLOCKED" ? projectColumns.find((column) => columnStatus(column.column_name) === "IN_PROGRESS") : undefined)
    ?? (task.status === "CANCELLED" ? projectColumns.find((column) => columnStatus(column.column_name) === "DONE") : undefined)
    ?? projectColumns.find((column) => columnStatus(column.column_name) === "TODO")
    ?? projectColumns[0];

  // Group placements by column, joined with their task, sorted by position.
  const cardsByColumn = useMemo(() => {
    const map = new Map<string, KanbanCardData[]>();
    for (const column of projectColumns) map.set(column.column_id, []);

    for (const placement of placements ?? []) {
      const task = taskMap.get(placement.task_id);
      if (!task || task.project_id !== projectId) continue;
      if (!isVisibleTeamMemberTask(task)) continue;
      const bucket = map.get(placement.column_id);
      if (!bucket) continue;
      bucket.push({ placementId: placement.kanban_task_id, task });
    }

    for (const [columnId, cards] of map) {
      const positioned = (placements ?? [])
        .filter((p) => p.column_id === columnId)
        .reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.kanban_task_id]: p.position }), {});
      cards.sort((a, b) => (positioned[a.placementId] ?? 0) - (positioned[b.placementId] ?? 0));
    }

    // Older tasks may not have a Kanban placement yet. Render those existing
    // tasks in the column matching their saved status so Team Leads can see
    // all assigned work without creating task cards themselves.
    const placedIds = new Set((placements ?? []).map((placement) => placement.task_id));
    for (const task of tasks ?? []) {
      if (task.project_id !== projectId || placedIds.has(task.task_id) || !isVisibleTeamMemberTask(task)) continue;
      const column = columnForTask(task);
      if (!column) continue;
      map.get(column.column_id)?.push({ placementId: `unplaced:${task.task_id}`, task });
    }

    return map;
  }, [projectColumns, placements, taskMap, tasks, projectId, isTeamLead, showSelfTasks, currentUser?.user_id, projectMemberIds, projectTeamIds, projectTeams]);

  const isTaskAwaitingReview = (task: Task) => {
    const placement = (placements ?? []).find((item) => item.task_id === task.task_id);
    const column = placement ? (columns ?? []).find((item) => item.column_id === placement.column_id) : undefined;
    const columnName = column?.column_name.trim().toLowerCase();
    if (task.status === "DONE" || (columnName && ["done", "complete", "completed"].includes(columnName))) return false;
    return task.status === "IN_REVIEW" || !!columnName && ["in review", "in-review", "review"].includes(columnName);
  };
  useEffect(() => {
    if (!approvedReviewTaskIds.size) return;
    setApprovedReviewTaskIds((current) => {
      const next = new Set(current);
      for (const taskId of current) {
        const task = taskMap.get(taskId);
        if (task && !isTaskAwaitingReview(task)) next.delete(taskId);
      }
      return next.size === current.size ? current : next;
    });
  }, [approvedReviewTaskIds, taskMap, placements, columns]);

  const placedTaskIds = useMemo(
    () => new Set((placements ?? []).filter((p) => taskMap.get(p.task_id)?.project_id === projectId).map((p) => p.task_id)),
    [placements, taskMap, projectId]
  );
  const unplacedTasks = useMemo(
    () => (tasks ?? []).filter((t) => t.project_id === projectId && !placedTaskIds.has(t.task_id)),
    [tasks, projectId, placedTaskIds]
  );

  const canApproveTaskReview = (task: Task) => !!currentUser && task.team_id != null &&
    (teams ?? []).some((team) => team.team_id === task.team_id &&
      (teamLeads ?? []).some((lead) => lead.team_lead_id === team.team_lead_id && lead.user_id === currentUser.user_id));

  const seedDefaultColumns = async () => {
    if (!projectId) return;
    setSeedingColumns(true);

    const existingNames = new Set(projectColumns.map((c) => c.column_name));
    const missing = DEFAULT_COLUMN_NAMES.filter((name) => !existingNames.has(name));
    let nextPos = projectColumns.length;
    let failures = 0;

    for (const name of missing) {
      try {
        await createColumn.mutateAsync({
          project_id: projectId,
          column_name: name,
          position: nextPos,
          color: DEFAULT_COLUMN_COLORS[name],
        });
        nextPos += 1;
      } catch (err) {
        failures += 1;
        toast.error(`Couldn't create "${name}" column: ${getApiErrorMessage(err)}`);
      }
    }

    if (failures === 0 && missing.length > 0) toast.success("Board created");
    else if (failures > 0) toast.info(`Created ${missing.length - failures} of ${missing.length} columns — click "Add Column" to retry the rest.`);

    setSeedingColumns(false);
  };

  const onDragEnd = async (result: DropResult) => {
    if (!canMoveKanbanCard) return;
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const movedCard = [...cardsByColumn.values()].flat().find((card) => card.placementId === draggableId);
    if (!movedCard) return;
    if (isTeamLead && (!showSelfTasks || movedCard?.task.user_id !== currentUser?.user_id)) {
      toast.error("Team Leads can move only their own assigned tasks. Developer cards are view-only.");
      return;
    }
    const sourceColumn = projectColumns.find((column) => column.column_id === source.droppableId);
    const destinationColumn = projectColumns.find((column) => column.column_id === destination.droppableId);
    const sourceIsReview = !!sourceColumn && ["IN REVIEW", "IN-REVIEW", "REVIEW"].includes(sourceColumn.column_name.trim().toUpperCase());
    const destinationIsDone = !!destinationColumn && ["DONE", "COMPLETE", "COMPLETED"].includes(destinationColumn.column_name.trim().toUpperCase());
    const reviewIsPending = movedCard && (movedCard.task.status === "IN_REVIEW" || sourceIsReview);
    if (reviewIsPending && destinationIsDone && !canApproveTaskReview(movedCard.task)) {
      toast.error("This task is awaiting Team Lead approval. It will move to Done after the assigned Team Lead approves it.");
      return;
    }

    try {
      if (draggableId.startsWith("unplaced:")) {
        const placement = await createTaskPlacement.mutateAsync({
          task_id: movedCard.task.task_id,
          column_id: destination.droppableId,
          position: destination.index,
        });
        const destinationColumn = projectColumns.find((column) => column.column_id === destination.droppableId);
        const mappedStatus = destinationColumn ? columnStatus(destinationColumn.column_name) : undefined;
        if (mappedStatus && movedCard.task.status !== mappedStatus) {
          await updateTask.mutateAsync({ id: movedCard.task.task_id, payload: { status: mappedStatus } });
        }
        toast.success("Task added to the board and moved");
        return placement;
      }

      await moveTask.mutateAsync({
        placementId: draggableId,
        payload: { column_id: destination.droppableId, position: destination.index },
      });

      const destinationColumn = projectColumns.find((c) => c.column_id === destination.droppableId);
      const mappedStatus = destinationColumn ? COLUMN_NAME_TO_STATUS[destinationColumn.column_name] : undefined;
      if (mappedStatus === "IN_PROGRESS" && movedCard && movedCard.task.status !== mappedStatus && movedCard.task.user_id === currentUser?.user_id && !activeTaskIds.has(movedCard.task.task_id)) {
        await startWork.mutateAsync([movedCard.task.task_id]);
        toast.success("Timer started; the task moved to In Progress");
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const startTaskWork = async (task: Task) => {
    try {
      await startWork.mutateAsync([task.task_id]);
      toast.success(activeWorkSession ? "Task added to your shared timer" : "Timer started; task moved to In Progress");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const approveTaskReview = async (task: Task) => {
    if (!isTaskAwaitingReview(task) || !canApproveTaskReview(task) || approvedReviewTaskIds.has(task.task_id) || approvingReviewTaskId === task.task_id || approveReview.isPending) return;
    setApprovingReviewTaskId(task.task_id);
    try {
      await approveReview.mutateAsync(task.task_id);
      setApprovedReviewTaskIds((current) => new Set(current).add(task.task_id));
      toast.success("Review approved; the task moved to Done and the developer was notified.");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setApprovingReviewTaskId(null);
    }
  };

  const confirmDeleteTask = async () => {
    if (!deletingTask) return;
    try {
      await deleteTask.mutateAsync(deletingTask.task_id);
      toast.success("Task deleted");
      setDeletingTask(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const toggleChecklistItem = async (task: Task, itemId: string) => {
    const checklistItems = (task.checklist_items ?? []).map((item) => item.item_id === itemId
      ? { ...item, is_completed: !item.is_completed }
      : item);
    try {
      await updateTask.mutateAsync({ id: task.task_id, payload: { checklist_items: checklistItems } });
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const formatElapsed = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
  };

  const isLoading = projectsLoading || columnsLoading || placementsLoading;

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col gap-6">
      <PageHeader title="Kanban Board" description="Visualize your workflow and track progress across all tasks" />

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-56">
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger>
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {selectableProjects.map((p) => (
                <SelectItem key={p.project_id} value={p.project_id}>
                  {p.project_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          </div>
          {isTeamLead && <Button
            type="button"
            variant={showSelfTasks ? "default" : "outline"}
            size="sm"
            aria-pressed={showSelfTasks}
            onClick={() => setShowSelfTasks((current) => !current)}
          ><UserRound className="h-4 w-4" />Self task</Button>}
        </div>

        {projectId && projectColumns.length > 0 && canManageKanbanBoard && !isTeamLead && (
          <div className="flex items-center gap-2">
            {projectColumns.length < DEFAULT_COLUMN_NAMES.length && (
              <Button variant="outline" size="sm" onClick={seedDefaultColumns} disabled={seedingColumns}>
                {seedingColumns ? "Adding..." : "Add missing default columns"}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setAddColumnOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Add Column
            </Button>
          </div>
        )}
      </div>

      {activeWorkSession && <div className="flex flex-col gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-violet-700" />
          <div className="min-w-0"><p className="text-sm font-semibold text-violet-900">Shared work timer · {formatElapsed(activeWorkSession.duration_seconds)}</p><p className="mt-0.5 text-xs text-violet-800">{activeWorkSession.task_names.join(" · ")} · Time is counted once for this session.</p></div>
        </div>
      </div>}

      {isLoading ? (
        <div className="flex min-h-[22rem] flex-1 gap-4 overflow-x-auto overflow-y-hidden scrollbar-thin">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-full min-h-[22rem] w-72 shrink-0" />
          ))}
        </div>
      ) : !projectId ? (
        <EmptyState icon={KanbanSquare} title="No projects yet" description="Create a project first to set up its board." />
      ) : projectColumns.length === 0 ? (
        <EmptyState
          icon={KanbanSquare}
          title="No board set up for this project"
          description={canManageKanbanBoard
            ? "Create the default columns (To Do, In Progress, In Review, Done) to get started."
            : "Ask a workspace administrator to set up this board. You can move tasks after it is ready."}
          actionLabel={canManageKanbanBoard ? (seedingColumns ? "Creating..." : "Create Board") : undefined}
          onAction={canManageKanbanBoard && !seedingColumns ? seedDefaultColumns : undefined}
        />
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex min-h-[22rem] min-w-0 flex-1 gap-4 overflow-x-auto scrollbar-thin pb-4">
            {projectColumns.map((column) => (
              <KanbanColumn
                key={column.column_id}
                column={column}
                cards={cardsByColumn.get(column.column_id) ?? []}
                userMap={userMap}
                canAddTask={canAddTaskToBoard}
                canMoveTask={isTeamLead ? showSelfTasks && canMoveKanbanCard : canMoveKanbanCard}
                canEditCard={(task) => !isDeveloperDashboard && !!currentUser && canUpdateTask(task.user_id, currentUser.user_id, permissionCodes)}
                canDeleteTask={!isDeveloperDashboard && canManageTasks}
                showEdgeMoveHandles={isDeveloperDashboard}
                onAddTask={(columnId) => setAddTaskColumnId(columnId)}
                canEditTask={(task) => !!currentUser && canUpdateTask(task.user_id, currentUser.user_id, permissionCodes)}
                onEditTask={setEditingTask}
                onDeleteTask={setDeletingTask}
                onStartWork={(task) => void startTaskWork(task)}
                onApproveReview={(task) => void approveTaskReview(task)}
                approvingReviewTaskId={approvingReviewTaskId}
                approvedReviewTaskIds={approvedReviewTaskIds}
                canApproveReview={canApproveTaskReview}
                onToggleChecklist={toggleChecklistItem}
                canStartWork={(task) => !!currentUser && task.user_id === currentUser.user_id && ["TODO", "IN_PROGRESS"].includes(task.status) && canUpdateTask(task.user_id, currentUser.user_id, permissionCodes)}
                activeTaskIds={activeTaskIds}
                taskWorkTimes={taskWorkTimes}
              />
            ))}
          </div>
        </DragDropContext>
      )}

      {canManageKanbanBoard && !isTeamLead && (
        <AddColumnDialog
          open={addColumnOpen}
          onOpenChange={setAddColumnOpen}
          projectId={projectId}
          nextPosition={projectColumns.length}
        />
      )}

      {canAddTaskToBoard && <AddTaskToColumnDialog
        open={!!addTaskColumnId}
        onOpenChange={(open) => !open && setAddTaskColumnId(null)}
        columnId={addTaskColumnId}
        columnName={addTaskColumn?.column_name}
        projectId={projectId}
        unplacedTasks={unplacedTasks}
        nextPosition={addTaskColumnId ? (cardsByColumn.get(addTaskColumnId)?.length ?? 0) : 0}
        canCreateTask={canManageTasks}
      />}

      <ConfirmDialog
        open={!!deletingTask}
        onOpenChange={(open) => !open && setDeletingTask(null)}
        title="Delete task?"
        description={`This will permanently delete "${deletingTask?.task_name ?? "this task"}" and its checklist.`}
        confirmLabel="Delete task"
        onConfirm={confirmDeleteTask}
        isLoading={deleteTask.isPending}
      />
      <TaskFormDialog
        open={!!editingTask}
        onOpenChange={(open) => !open && setEditingTask(null)}
        task={editingTask}
        kanbanCardEdit
      />
    </div>
  );
}
