"use client";

import { useMemo, useState } from "react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { KanbanSquare, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { KanbanColumn } from "@/components/modules/kanban/kanban-column";
import type { KanbanCardData } from "@/components/modules/kanban/kanban-column";
import { AddTaskToColumnDialog } from "@/components/modules/kanban/add-task-to-column-dialog";
import { AddColumnDialog } from "@/components/modules/kanban/add-column-dialog";
import { useProjects } from "@/hooks/queries/use-projects";
import { useTasks } from "@/hooks/queries/use-tasks";
import { useUsers } from "@/hooks/queries/use-users";
import {
  useCreateKanbanColumn,
  useKanbanColumns,
  useKanbanTaskPlacements,
  useMoveKanbanTask,
} from "@/hooks/queries/use-kanban";
import { useUpdateTask } from "@/hooks/queries/use-tasks";
import { DEFAULT_COLUMN_COLORS, DEFAULT_COLUMN_NAMES, COLUMN_NAME_TO_STATUS } from "@/lib/constants";
import { getApiErrorMessage } from "@/lib/api/client";

export default function KanbanPage() {
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const [projectId, setProjectId] = useState<string>("");

  const { data: columns, isLoading: columnsLoading } = useKanbanColumns();
  const { data: placements, isLoading: placementsLoading } = useKanbanTaskPlacements();
  const { data: tasks } = useTasks({ limit: 500 });
  const { data: users } = useUsers();

  const createColumn = useCreateKanbanColumn();
  const moveTask = useMoveKanbanTask();
  const updateTask = useUpdateTask();

  const [addTaskColumnId, setAddTaskColumnId] = useState<string | null>(null);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [seedingColumns, setSeedingColumns] = useState(false);

  // Default to the first project once projects load.
  useMemo(() => {
    if (!projectId && projects && projects.length > 0) setProjectId(projects[0].project_id);
  }, [projects, projectId]);

  const userMap = useMemo(() => new Map((users ?? []).map((u) => [u.user_id, u])), [users]);
  const taskMap = useMemo(() => new Map((tasks ?? []).map((t) => [t.task_id, t])), [tasks]);

  const projectColumns = useMemo(
    () => (columns ?? []).filter((c) => c.project_id === projectId).sort((a, b) => a.position - b.position),
    [columns, projectId]
  );

  const addTaskColumn = projectColumns.find((c) => c.column_id === addTaskColumnId);

  // Group placements by column, joined with their task, sorted by position.
  const cardsByColumn = useMemo(() => {
    const map = new Map<string, KanbanCardData[]>();
    for (const column of projectColumns) map.set(column.column_id, []);

    for (const placement of placements ?? []) {
      const task = taskMap.get(placement.task_id);
      if (!task || task.project_id !== projectId) continue;
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

    return map;
  }, [projectColumns, placements, taskMap, projectId]);

  const placedTaskIds = useMemo(
    () => new Set((placements ?? []).filter((p) => taskMap.get(p.task_id)?.project_id === projectId).map((p) => p.task_id)),
    [placements, taskMap, projectId]
  );
  const unplacedTasks = useMemo(
    () => (tasks ?? []).filter((t) => t.project_id === projectId && !placedTaskIds.has(t.task_id)),
    [tasks, projectId, placedTaskIds]
  );

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
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    try {
      await moveTask.mutateAsync({
        placementId: draggableId,
        payload: { column_id: destination.droppableId, position: destination.index },
      });

      const destinationColumn = projectColumns.find((c) => c.column_id === destination.droppableId);
      const mappedStatus = destinationColumn ? COLUMN_NAME_TO_STATUS[destinationColumn.column_name] : undefined;
      const movedCard = [...cardsByColumn.values()].flat().find((c) => c.placementId === draggableId);
      if (mappedStatus && movedCard && movedCard.task.status !== mappedStatus) {
        await updateTask.mutateAsync({ id: movedCard.task.task_id, payload: { status: mappedStatus } });
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const isLoading = projectsLoading || columnsLoading || placementsLoading;

  return (
    <div className="flex h-full flex-col space-y-6">
      <PageHeader title="Kanban Board" description="Visualize your workflow and track progress across all tasks" />

      <div className="flex items-center justify-between gap-3">
        <div className="w-56">
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger>
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {(projects ?? []).map((p) => (
                <SelectItem key={p.project_id} value={p.project_id}>
                  {p.project_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {projectId && projectColumns.length > 0 && (
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

      {isLoading ? (
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-96 w-72 shrink-0" />
          ))}
        </div>
      ) : !projectId ? (
        <EmptyState icon={KanbanSquare} title="No projects yet" description="Create a project first to set up its board." />
      ) : projectColumns.length === 0 ? (
        <EmptyState
          icon={KanbanSquare}
          title="No board set up for this project"
          description="Create the default columns (To Do, In Progress, In Review, Done) to get started."
          actionLabel={seedingColumns ? "Creating..." : "Create Board"}
          onAction={seedingColumns ? undefined : seedDefaultColumns}
        />
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex flex-1 gap-4 overflow-x-auto scrollbar-thin pb-4">
            {projectColumns.map((column) => (
              <KanbanColumn
                key={column.column_id}
                column={column}
                cards={cardsByColumn.get(column.column_id) ?? []}
                userMap={userMap}
                onAddTask={(columnId) => setAddTaskColumnId(columnId)}
              />
            ))}
          </div>
        </DragDropContext>
      )}

      <AddColumnDialog
        open={addColumnOpen}
        onOpenChange={setAddColumnOpen}
        projectId={projectId}
        nextPosition={projectColumns.length}
      />

      <AddTaskToColumnDialog
        open={!!addTaskColumnId}
        onOpenChange={(open) => !open && setAddTaskColumnId(null)}
        columnId={addTaskColumnId}
        columnName={addTaskColumn?.column_name}
        projectId={projectId}
        unplacedTasks={unplacedTasks}
        nextPosition={addTaskColumnId ? (cardsByColumn.get(addTaskColumnId)?.length ?? 0) : 0}
      />
    </div>
  );
}