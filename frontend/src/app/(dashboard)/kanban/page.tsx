"use client";

import { useEffect, useMemo, useState } from "react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { Archive, Clock, KanbanSquare, Plus, RotateCcw, UserRound } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KanbanColumn } from "@/components/modules/kanban/kanban-column";
import type { KanbanCardData } from "@/components/modules/kanban/kanban-column";
import type { KanbanCardFeature } from "@/components/modules/kanban/kanban-card-feature-dialog";
import { AddTaskToColumnDialog } from "@/components/modules/kanban/add-task-to-column-dialog";
import { AddColumnDialog } from "@/components/modules/kanban/add-column-dialog";
import { KanbanCardDetailsDialog } from "@/components/modules/kanban/kanban-card-details-dialog";
import { KanbanCardMembersDialog } from "@/components/modules/kanban/kanban-card-members-dialog";
import { useProjectComponents, useProjectReleases, useProjects } from "@/hooks/queries/use-projects";
import { useStartWorkSession, useSprints, useTasks, useTaskWorkTimes, useWorkSessions, useUpdateCardChecklist, useUpdateTask, useDeleteTask } from "@/hooks/queries/use-tasks";
import { useUsers } from "@/hooks/queries/use-users";
import { useTeamLeads, useTeams } from "@/hooks/queries/use-teams";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuthStore } from "@/store/auth-store";
import {
  useCreateKanbanColumn,
  useKanbanColumns,
  useKanbanLabels,
  useKanbanTaskPlacements,
  useApproveKanbanReview,
  useCancelKanbanReview,
  useMoveKanbanTask,
  useCreateKanbanTaskPlacement,
  useArchiveKanbanCard,
  useArchivedKanbanCards,
  useRestoreKanbanCard,
} from "@/hooks/queries/use-kanban";
import { DEFAULT_COLUMN_COLORS, DEFAULT_COLUMN_NAMES, COLUMN_NAME_TO_STATUS, TASK_PRIORITIES, PRIORITY_LABEL } from "@/lib/constants";
import { getApiErrorMessage } from "@/lib/api/client";
import type { Task } from "@/types/task";
import type { KanbanColumn as KanbanColumnType } from "@/types/kanban";

const ALL_FILTERS = "__all__";

export default function KanbanPage() {
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const [projectId, setProjectId] = useState<string>("");

  const { data: columns, isLoading: columnsLoading } = useKanbanColumns();
  const { data: kanbanLabels = [] } = useKanbanLabels();
  const { data: placements, isLoading: placementsLoading } = useKanbanTaskPlacements();
  const { data: tasks } = useTasks({ limit: 500 });
  const { data: projectComponents = [] } = useProjectComponents(projectId || undefined);
  const { data: projectReleases = [] } = useProjectReleases(projectId || undefined);
  const { data: projectSprints = [] } = useSprints(projectId || undefined);
  const { data: workSessions = [] } = useWorkSessions();
  const { data: workTimes = [] } = useTaskWorkTimes();
  const { data: users } = useUsers();
  const { data: teams } = useTeams();
  const { data: teamLeads } = useTeamLeads();
  const { canManageKanbanBoard, canMoveKanbanCard, permissionCodes } = usePermissions();
  const currentUser = useAuthStore((state) => state.user);
  const isDeveloperDashboard = currentUser?.role_names?.some((role) => role.trim().toLowerCase() === "developer") ?? false;
  const isTeamLead = currentUser?.role_names?.some((role) => role.trim().toLowerCase() === "team lead") ?? false;
  const isProjectManager = currentUser?.role_names?.some((role) => role.trim().toLowerCase() === "project manager") ?? false;
  const canMoveSelectedProjectCards = canMoveKanbanCard || (!!currentUser &&
    (projects ?? []).some((project) => project.project_id === projectId && project.project_manager_user_id === currentUser.user_id));

  const createColumn = useCreateKanbanColumn();
  const moveTask = useMoveKanbanTask();
  const createTaskPlacement = useCreateKanbanTaskPlacement();
  const approveReview = useApproveKanbanReview();
  const cancelReview = useCancelKanbanReview();
  const updateTask = useUpdateTask();
  const updateCardChecklist = useUpdateCardChecklist();
  const startWork = useStartWorkSession();
  const archiveCard = useArchiveKanbanCard();
  const restoreCard = useRestoreKanbanCard();
  const deleteTask = useDeleteTask();

  const [addTaskColumnId, setAddTaskColumnId] = useState<string | null>(null);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<KanbanColumnType | null>(null);
  const [cardDetailsTask, setCardDetailsTask] = useState<Task | null>(null);
  const [cardMembersTask, setCardMembersTask] = useState<Task | null>(null);
  const [archivingTask, setArchivingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [approvingReviewTaskId, setApprovingReviewTaskId] = useState<string | null>(null);
  const [cancellingReviewTaskId, setCancellingReviewTaskId] = useState<string | null>(null);
  const [approvedReviewTaskIds, setApprovedReviewTaskIds] = useState<Set<string>>(() => new Set());
  const [seedingColumns, setSeedingColumns] = useState(false);
  const [showSelfTasks, setShowSelfTasks] = useState(false);
  const [boardSearch, setBoardSearch] = useState("");
  const [boardPriorityFilter, setBoardPriorityFilter] = useState(ALL_FILTERS);
  const [boardAssigneeFilter, setBoardAssigneeFilter] = useState(ALL_FILTERS);
  const [boardComponentFilter, setBoardComponentFilter] = useState(ALL_FILTERS);
  const [boardReleaseFilter, setBoardReleaseFilter] = useState(ALL_FILTERS);
  const [boardEpicFilter, setBoardEpicFilter] = useState(ALL_FILTERS);
  const [boardSprintFilter, setBoardSprintFilter] = useState(ALL_FILTERS);
  const [boardLabelFilter, setBoardLabelFilter] = useState("");
  const [boardGroupBy, setBoardGroupBy] = useState<"__all__" | "assignee" | "priority">(ALL_FILTERS);
  const { data: archivedCards = [], isLoading: archivedCardsLoading } = useArchivedKanbanCards(projectId, archivedOpen);
  const canAddTaskToBoard = permissionCodes.some((code) => ["kanban.cards.create", "kanban.tasks.create", "tasks.create", "roles.manage"].includes(code));
  const cardFeaturePermission: Record<KanbanCardFeature, string> = {
    labels: "kanban.card_labels.update",
    dates: "kanban.card_dates.update",
    checklist: "kanban.card_checklists.update",
    attachments: "kanban.card_attachments.upload",
  };
  const canUseCardFeature = (feature: KanbanCardFeature, task: Task) => permissionCodes.includes(cardFeaturePermission[feature]) ||
    feature === "attachments" && (permissionCodes.includes("kanban.card_attachments.view") || permissionCodes.includes("kanban.card_attachments.delete")) ||
    permissionCodes.includes("tasks.update") || permissionCodes.includes("roles.manage") ||
    !!currentUser && task.user_id === currentUser.user_id && permissionCodes.includes("tasks.update_assigned");
  const canEditCardDetails = (task: Task) => permissionCodes.includes("kanban.cards.details.update")
    || permissionCodes.includes("tasks.update")
    || permissionCodes.includes("roles.manage")
    || (!!currentUser && task.user_id === currentUser.user_id && permissionCodes.includes("tasks.update_assigned"));
  const canManageCardMembers = () => permissionCodes.includes("kanban.cards.members.manage") || permissionCodes.includes("roles.manage");
  const canManageChecklistItemDetails = permissionCodes.includes("kanban.card_checklists.items.manage") || permissionCodes.includes("roles.manage");
  const canManageLabelCatalog = permissionCodes.includes("kanban.labels.manage") || permissionCodes.includes("roles.manage");
  const canArchiveCard = permissionCodes.some((code) => ["kanban.cards.archive", "kanban.tasks.delete", "roles.manage"].includes(code));
  const canDeleteCard = permissionCodes.some((code) => ["tasks.delete", "tasks.manage", "roles.manage"].includes(code));
  const canRestoreCard = permissionCodes.some((code) => ["kanban.cards.restore", "roles.manage"].includes(code));
  const canUpdateAssignedTask = (task: Task) => !!currentUser && (
    permissionCodes.includes("tasks.update") || permissionCodes.includes("roles.manage") ||
    (task.user_id === currentUser.user_id && permissionCodes.includes("tasks.update_assigned"))
  );
  useEffect(() => {
    if (isTeamLead && new URLSearchParams(window.location.search).get("view") === "self") {
      setShowSelfTasks(true);
    }
  }, [isTeamLead]);
  useEffect(() => {
    setBoardEpicFilter(ALL_FILTERS);
    setBoardSprintFilter(ALL_FILTERS);
  }, [projectId]);
  const taskWorkTimes = useMemo(() => new Map(workTimes.map((item) => [item.task_id, item])), [workTimes]);
  const labelColors = useMemo(() => Object.fromEntries(kanbanLabels.map((label) => [label.label_key, label.color])), [kanbanLabels]);
  const labelNames = useMemo(() => Object.fromEntries(kanbanLabels.map((label) => [label.label_key, label.name])), [kanbanLabels]);

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
  const currentCardDetailsTask = cardDetailsTask ? taskMap.get(cardDetailsTask.task_id) ?? cardDetailsTask : null;
  const currentCardMembersTask = cardMembersTask ? taskMap.get(cardMembersTask.task_id) ?? cardMembersTask : null;

  const projectColumns = useMemo(
    () => (columns ?? []).filter((c) => c.project_id === projectId).sort((a, b) => a.position - b.position),
    [columns, projectId]
  );
  const boardViewConstrained = !!boardSearch.trim() || boardPriorityFilter !== ALL_FILTERS || boardAssigneeFilter !== ALL_FILTERS || boardComponentFilter !== ALL_FILTERS || boardReleaseFilter !== ALL_FILTERS || boardEpicFilter !== ALL_FILTERS || boardSprintFilter !== ALL_FILTERS || !!boardLabelFilter.trim() || boardGroupBy !== ALL_FILTERS;

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
      cards.sort((a, b) => {
        if (boardGroupBy === "priority") {
          const priorityOrder = ["URGENT", "HIGH", "MEDIUM", "LOW"];
          const priorityDifference = priorityOrder.indexOf(a.task.priority) - priorityOrder.indexOf(b.task.priority);
          if (priorityDifference !== 0) return priorityDifference;
        } else if (boardGroupBy === "assignee") {
          const assigneeA = a.task.user_id ? userMap.get(a.task.user_id)?.name ?? a.task.assignee_name ?? "Assigned" : "Unassigned";
          const assigneeB = b.task.user_id ? userMap.get(b.task.user_id)?.name ?? b.task.assignee_name ?? "Assigned" : "Unassigned";
          const assigneeDifference = assigneeA.localeCompare(assigneeB);
          if (assigneeDifference !== 0) return assigneeDifference;
        }
        return (positioned[a.placementId] ?? 0) - (positioned[b.placementId] ?? 0);
      });
    }

    // Older tasks may not have a Kanban placement yet. Render those existing
    // tasks in the column matching their saved status so Team Leads can see
    // all assigned work without creating task cards themselves.
    const placedIds = new Set((placements ?? []).map((placement) => placement.task_id));
    for (const task of tasks ?? []) {
      if (task.project_id !== projectId || task.archived_at || placedIds.has(task.task_id) || !isVisibleTeamMemberTask(task)) continue;
      const column = columnForTask(task);
      if (!column) continue;
      map.get(column.column_id)?.push({ placementId: `unplaced:${task.task_id}`, task });
    }

    const normalizedSearch = boardSearch.trim().toLocaleLowerCase();
    for (const [columnId, cards] of map) {
      map.set(columnId, cards.filter(({ task }) => {
        const matchesSearch = !normalizedSearch || `${task.task_name} ${task.description ?? ""}`.toLocaleLowerCase().includes(normalizedSearch);
        const matchesPriority = boardPriorityFilter === ALL_FILTERS || task.priority === boardPriorityFilter;
        const matchesAssignee = boardAssigneeFilter === ALL_FILTERS
          || (boardAssigneeFilter === "__unassigned__" ? !task.user_id : task.user_id === boardAssigneeFilter);
        const matchesComponent = boardComponentFilter === ALL_FILTERS || task.component_id === boardComponentFilter;
        const matchesRelease = boardReleaseFilter === ALL_FILTERS || task.release_id === boardReleaseFilter;
        const matchesEpic = boardEpicFilter === ALL_FILTERS || task.task_id === boardEpicFilter || task.parent_task_id === boardEpicFilter;
        const matchesSprint = boardSprintFilter === ALL_FILTERS || task.sprint_id === boardSprintFilter;
        const matchesLabel = !boardLabelFilter.trim() || (task.labels ?? []).includes(boardLabelFilter.trim().toLocaleLowerCase());
        return matchesSearch && matchesPriority && matchesAssignee && matchesComponent && matchesRelease && matchesEpic && matchesSprint && matchesLabel;
      }));
    }

    return map;
  }, [projectColumns, placements, taskMap, tasks, projectId, isTeamLead, showSelfTasks, currentUser?.user_id, projectMemberIds, projectTeamIds, projectTeams, boardSearch, boardPriorityFilter, boardAssigneeFilter, boardComponentFilter, boardReleaseFilter, boardEpicFilter, boardSprintFilter, boardLabelFilter, boardGroupBy, userMap]);

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
    () => (tasks ?? []).filter((t) => t.project_id === projectId && !t.archived_at && !placedTaskIds.has(t.task_id)),
    [tasks, projectId, placedTaskIds]
  );

  const canApproveTaskReview = (task: Task) => !!currentUser && task.project_id === projectId && (
    (task.team_id != null && (teams ?? []).some((team) => team.team_id === task.team_id &&
      (teamLeads ?? []).some((lead) => lead.team_lead_id === team.team_lead_id && lead.user_id === currentUser.user_id))) ||
    (isProjectManager && (projects ?? []).some((project) => project.project_id === task.project_id && project.project_manager_user_id === currentUser.user_id))
  );
  const canCancelTaskReview = (task: Task) => !!currentUser && isProjectManager && task.project_id === projectId &&
    (projects ?? []).some((project) => project.project_id === task.project_id && project.project_manager_user_id === currentUser.user_id);

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
    if (!canMoveSelectedProjectCards || boardViewConstrained) return;
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
      toast.error("This task is awaiting review. It will move to Done after its assigned Team Lead or Project Manager approves it.");
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

  const cancelTaskReview = async (task: Task, comment: string) => {
    if (!isTaskAwaitingReview(task) || !canCancelTaskReview(task) || !comment.trim()) return;
    setCancellingReviewTaskId(task.task_id);
    try {
      await cancelReview.mutateAsync({ taskId: task.task_id, comment: comment.trim() });
      toast.success("Changes requested; the task is back in To Do and the developer was notified.");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
      throw err;
    } finally {
      setCancellingReviewTaskId(null);
    }
  };

  const confirmArchiveTask = async () => {
    if (!archivingTask) return;
    try {
      await archiveCard.mutateAsync(archivingTask.task_id);
      toast.success("Card archived. You can restore it from Archived cards.");
      setArchivingTask(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const confirmDeleteTask = async () => {
    if (!deletingTask) return;
    try {
      await deleteTask.mutateAsync(deletingTask.task_id);
      toast.success(`"${deletingTask.task_name}" deleted`);
      setDeletingTask(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const handleRestoreCard = async (task: Task) => {
    try {
      await restoreCard.mutateAsync(task.task_id);
      toast.success(`"${task.task_name}" restored to the board`);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const toggleChecklistItem = async (task: Task, itemId: string) => {
    const checklistItems = (task.checklist_items ?? []).map((item) => item.item_id === itemId
      ? { ...item, is_completed: !item.is_completed }
      : item);
    try {
      await updateCardChecklist.mutateAsync({ taskId: task.task_id, items: checklistItems });
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
          {(canArchiveCard || canRestoreCard) && <Button type="button" variant="outline" size="sm" onClick={() => setArchivedOpen(true)} disabled={!projectId}>
            <Archive className="h-4 w-4" />Archived cards
          </Button>}
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

      {projectId && projectColumns.length > 0 && <div className="flex flex-wrap items-center gap-2">
        <Input className="w-full sm:w-56" type="search" placeholder="Search cards" aria-label="Search Kanban cards" value={boardSearch} onChange={(event) => setBoardSearch(event.target.value)} />
        <Input className="w-full sm:w-40" placeholder="Filter by label" aria-label="Filter Kanban cards by label" value={boardLabelFilter} onChange={(event) => setBoardLabelFilter(event.target.value)} />
        <Select value={boardPriorityFilter} onValueChange={setBoardPriorityFilter}>
          <SelectTrigger className="w-36" aria-label="Filter cards by priority"><SelectValue placeholder="All priorities" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTERS}>All priorities</SelectItem>
            {TASK_PRIORITIES.map((priority) => <SelectItem key={priority} value={priority}>{PRIORITY_LABEL[priority]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={boardAssigneeFilter} onValueChange={setBoardAssigneeFilter}>
          <SelectTrigger className="w-40" aria-label="Filter cards by assignee"><SelectValue placeholder="All assignees" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTERS}>All assignees</SelectItem>
            <SelectItem value="__unassigned__">Unassigned</SelectItem>
            {(users ?? []).filter((user) => user.is_active).map((user) => <SelectItem key={user.user_id} value={user.user_id}>{user.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {projectComponents.length > 0 && <Select value={boardComponentFilter} onValueChange={setBoardComponentFilter}>
          <SelectTrigger className="w-40" aria-label="Filter cards by component"><SelectValue placeholder="All components" /></SelectTrigger>
          <SelectContent><SelectItem value={ALL_FILTERS}>All components</SelectItem>{projectComponents.map((component) => <SelectItem key={component.component_id} value={component.component_id}>{component.name}</SelectItem>)}</SelectContent>
        </Select>}
        {projectReleases.length > 0 && <Select value={boardReleaseFilter} onValueChange={setBoardReleaseFilter}>
          <SelectTrigger className="w-40" aria-label="Filter cards by release"><SelectValue placeholder="All releases" /></SelectTrigger>
          <SelectContent><SelectItem value={ALL_FILTERS}>All releases</SelectItem>{projectReleases.map((release) => <SelectItem key={release.release_id} value={release.release_id}>{release.name}{release.version ? ` · ${release.version}` : ""}</SelectItem>)}</SelectContent>
        </Select>}
        {(tasks ?? []).some((task) => task.project_id === projectId && task.task_type === "EPIC") && <Select value={boardEpicFilter} onValueChange={setBoardEpicFilter}>
          <SelectTrigger className="w-40" aria-label="Filter cards by epic"><SelectValue placeholder="All epics" /></SelectTrigger>
          <SelectContent><SelectItem value={ALL_FILTERS}>All epics</SelectItem>{(tasks ?? []).filter((task) => task.project_id === projectId && task.task_type === "EPIC").map((epic) => <SelectItem key={epic.task_id} value={epic.task_id}>{epic.task_name}</SelectItem>)}</SelectContent>
        </Select>}
        {projectSprints.length > 0 && <Select value={boardSprintFilter} onValueChange={setBoardSprintFilter}>
          <SelectTrigger className="w-40" aria-label="Filter cards by sprint"><SelectValue placeholder="All sprints" /></SelectTrigger>
          <SelectContent><SelectItem value={ALL_FILTERS}>All sprints</SelectItem>{projectSprints.map((sprint) => <SelectItem key={sprint.sprint_id} value={sprint.sprint_id}>{sprint.sprint_name}</SelectItem>)}</SelectContent>
        </Select>}
        <Select value={boardGroupBy} onValueChange={(value) => setBoardGroupBy(value as typeof boardGroupBy)}>
          <SelectTrigger className="w-40" aria-label="Group cards by"><SelectValue placeholder="Group by" /></SelectTrigger>
          <SelectContent><SelectItem value={ALL_FILTERS}>No grouping</SelectItem><SelectItem value="assignee">Assignee lanes</SelectItem><SelectItem value="priority">Priority lanes</SelectItem></SelectContent>
        </Select>
        {boardViewConstrained && <>
          <Button type="button" variant="ghost" size="sm" onClick={() => { setBoardSearch(""); setBoardPriorityFilter(ALL_FILTERS); setBoardAssigneeFilter(ALL_FILTERS); setBoardComponentFilter(ALL_FILTERS); setBoardReleaseFilter(ALL_FILTERS); setBoardEpicFilter(ALL_FILTERS); setBoardSprintFilter(ALL_FILTERS); setBoardLabelFilter(""); setBoardGroupBy(ALL_FILTERS); }}>Clear view</Button>
          <span className="text-xs text-muted-foreground">Clear filters and grouping to move cards and preserve their board positions.</span>
        </>}
      </div>}

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
                canEditColumn={canManageKanbanBoard && !isTeamLead}
                onEditColumn={setEditingColumn}
                canMoveTask={!boardViewConstrained && (isTeamLead ? showSelfTasks && canMoveKanbanCard : canMoveSelectedProjectCards)}
                canEditCard={(task) => canEditCardDetails(task)}
                canArchiveTask={() => canArchiveCard}
                canDeleteTask={() => canDeleteCard}
                showEdgeMoveHandles={isDeveloperDashboard}
                onAddTask={(columnId) => setAddTaskColumnId(columnId)}
                canEditTask={(task) => canUpdateAssignedTask(task)}
                canEditChecklist={(task) => canUseCardFeature("checklist", task)}
                onEditTask={setCardDetailsTask}
                onViewTaskDetails={setCardDetailsTask}
                canManageCardMembers={() => canManageCardMembers()}
                onManageCardMembers={setCardMembersTask}
                canUseCardFeature={canUseCardFeature}
                labelColors={labelColors}
                labelNames={labelNames}
                onCardFeature={(task) => setCardDetailsTask(task)}
                onArchiveTask={setArchivingTask}
                onDeleteTask={setDeletingTask}
                onStartWork={(task) => void startTaskWork(task)}
                onApproveReview={(task) => void approveTaskReview(task)}
                onCancelReview={(task, comment) => cancelTaskReview(task, comment)}
                approvingReviewTaskId={approvingReviewTaskId}
                cancellingReviewTaskId={cancellingReviewTaskId}
                approvedReviewTaskIds={approvedReviewTaskIds}
                canApproveReview={canApproveTaskReview}
                canCancelReview={canCancelTaskReview}
                onToggleChecklist={toggleChecklistItem}
                canStartWork={(task) => !!currentUser && task.user_id === currentUser.user_id && ["TODO", "IN_PROGRESS"].includes(task.status) && canUpdateAssignedTask(task)}
                activeTaskIds={activeTaskIds}
                taskWorkTimes={taskWorkTimes}
                groupBy={boardGroupBy === "__all__" ? undefined : boardGroupBy}
              />
            ))}
          </div>
        </DragDropContext>
      )}

      {canManageKanbanBoard && !isTeamLead && (
        <AddColumnDialog
          open={addColumnOpen || !!editingColumn}
          onOpenChange={(open) => {
            if (!open) {
              setAddColumnOpen(false);
              setEditingColumn(null);
            } else if (!editingColumn) {
              setAddColumnOpen(true);
            }
          }}
          projectId={projectId}
          nextPosition={projectColumns.length}
          column={editingColumn}
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
        canCreateTask={canAddTaskToBoard}
        canAttachExisting={canManageKanbanBoard}
      />}

      <ConfirmDialog
        open={!!archivingTask}
        onOpenChange={(open) => !open && setArchivingTask(null)}
        title="Archive card?"
        description={`"${archivingTask?.task_name ?? "This card"}" will leave the active board. You can restore it later.`}
        confirmLabel="Archive card"
        onConfirm={confirmArchiveTask}
        isLoading={archiveCard.isPending}
      />
      <ConfirmDialog
        open={!!deletingTask}
        onOpenChange={(open) => !open && setDeletingTask(null)}
        title="Delete task permanently?"
        description={`"${deletingTask?.task_name ?? "This task"}" will be permanently removed, including its associated task data. This action cannot be undone.`}
        confirmLabel="Delete task"
        onConfirm={confirmDeleteTask}
        isLoading={deleteTask.isPending}
      />
      <KanbanCardDetailsDialog
        open={!!cardDetailsTask}
        onOpenChange={(open) => !open && setCardDetailsTask(null)}
        task={currentCardDetailsTask}
        canEdit={currentCardDetailsTask ? canEditCardDetails(currentCardDetailsTask) : false}
        canManageMembers={canManageCardMembers()}
        onManageMembers={setCardMembersTask}
        canViewComments={permissionCodes.some((code) => ["tasks.comments.view", "tasks.comments.create", "tasks.manage", "roles.manage"].includes(code))}
        canPostComments={permissionCodes.some((code) => ["tasks.comments.create", "tasks.manage", "roles.manage"].includes(code))}
        canViewAttachments={permissionCodes.some((code) => ["kanban.card_attachments.view", "kanban.card_attachments.upload", "kanban.card_attachments.delete", "tasks.update", "tasks.update_assigned", "roles.manage"].includes(code))}
        canUploadAttachments={permissionCodes.some((code) => ["kanban.card_attachments.upload", "tasks.update", "tasks.update_assigned", "roles.manage"].includes(code))}
        canDeleteAttachments={permissionCodes.some((code) => ["kanban.card_attachments.delete", "tasks.update", "roles.manage"].includes(code))}
        canManageLabels={canManageLabelCatalog}
        canEditLabels={permissionCodes.includes("kanban.card_labels.update") || (!!currentCardDetailsTask && canUpdateAssignedTask(currentCardDetailsTask))}
        canEditDates={permissionCodes.some((code) => ["kanban.card_dates.update", "tasks.update", "roles.manage"].includes(code)) || (!!currentCardDetailsTask && canUpdateAssignedTask(currentCardDetailsTask))}
        canEditChecklist={permissionCodes.some((code) => ["kanban.card_checklists.update", "tasks.update", "roles.manage"].includes(code)) || (!!currentCardDetailsTask && canUpdateAssignedTask(currentCardDetailsTask))}
        canManageChecklistItemDetails={canManageChecklistItemDetails}
      />
      <KanbanCardMembersDialog
        open={!!cardMembersTask}
        onOpenChange={(open) => !open && setCardMembersTask(null)}
        task={currentCardMembersTask}
      />
      <Dialog open={archivedOpen} onOpenChange={setArchivedOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Archived cards</DialogTitle>
            <DialogDescription>Cards keep their task, activity, and timer history while archived.</DialogDescription>
          </DialogHeader>
          {archivedCardsLoading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading archived cards…</p>
            : archivedCards.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No archived cards in this project.</p>
              : <div className="space-y-2">
                {archivedCards.map((task) => <div key={task.task_id} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{task.task_name}</p><p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{task.description || "No description"}</p></div>
                  {canRestoreCard && <Button type="button" variant="outline" size="sm" onClick={() => void handleRestoreCard(task)} disabled={restoreCard.isPending}>
                    <RotateCcw className="h-3.5 w-3.5" />Restore
                  </Button>}
                </div>)}
              </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
