"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GanttChartSquare, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GanttChart } from "@/components/modules/gantt/gantt-chart";
import { GanttFormDialog } from "@/components/modules/gantt/gantt-form-dialog";
import { useProjects } from "@/hooks/queries/use-projects";
import { useTasks } from "@/hooks/queries/use-tasks";
import { useUsers } from "@/hooks/queries/use-users";
import { useDeleteGanttTask, useGanttTasks } from "@/hooks/queries/use-gantt";
import { getApiErrorMessage } from "@/lib/api/client";
import type { GanttTask } from "@/types/gantt";
import { usePermissions } from "@/hooks/use-permissions";
import { tasksApi } from "@/lib/api/tasks";

export default function GanttPage() {
  const { canManageGantt } = usePermissions();
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const [projectId, setProjectId] = useState("");

  const { data: ganttTasks, isLoading: ganttLoading } = useGanttTasks();
  const { data: projectTaskLinks = [], isLoading: linksLoading } = useQuery({
    queryKey: ["project-task-links", projectId],
    queryFn: () => tasksApi.getProjectLinks(projectId),
    enabled: !!projectId,
  });
  const { data: tasks, isLoading: tasksLoading } = useTasks({ limit: 500 });
  const { data: users } = useUsers();
  const deleteMutation = useDeleteGanttTask();

  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<GanttTask | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<GanttTask | null>(null);

  useMemo(() => {
    if (!projectId && projects && projects.length > 0) setProjectId(projects[0].project_id);
  }, [projects, projectId]);

  const userMap = useMemo(() => new Map((users ?? []).map((u) => [u.user_id, u])), [users]);

  const projectTasks = useMemo(() => (tasks ?? []).filter((t) => t.project_id === projectId), [tasks, projectId]);
  const taskMap = useMemo(() => new Map(projectTasks.map((t) => [t.task_id, t])), [projectTasks]);

  const projectEntries = useMemo(
    () => (ganttTasks ?? []).filter((g) => g.project_id === projectId),
    [ganttTasks, projectId]
  );

  const scheduledTaskIds = useMemo(() => new Set(projectEntries.map((e) => e.task_id)), [projectEntries]);
  const schedulableTasks = useMemo(
    () => projectTasks.filter((t) => !scheduledTaskIds.has(t.task_id)),
    [projectTasks, scheduledTaskIds]
  );

  const openCreate = () => {
    setEditingEntry(null);
    setFormOpen(true);
  };
  const openEdit = (entry: GanttTask) => {
    setEditingEntry(entry);
    setFormOpen(true);
  };
  const confirmDelete = async () => {
    if (!deletingEntry) return;
    try {
      await deleteMutation.mutateAsync(deletingEntry.gantt_id);
      toast.success("Removed from timeline");
      setDeletingEntry(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const isLoading = projectsLoading || ganttLoading || tasksLoading || linksLoading;
  const overallProgress =
    projectEntries.length > 0
      ? Math.round(projectEntries.reduce((sum, e) => sum + Number(e.progress || 0), 0) / projectEntries.length)
      : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gantt Chart"
        description="Plan, schedule, and track your project timeline"
        actions={canManageGantt ? (
          <Button onClick={openCreate} disabled={!projectId || schedulableTasks.length === 0}>
            <Plus className="h-4 w-4" />
            Schedule Task
          </Button>
        ) : undefined}
      />

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

        {projectEntries.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Project Progress:</span>
            {overallProgress}%
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        {[
          ["To Do", "#94A3B8"],
          ["In Progress", "#3B82F6"],
          ["In Review", "#F59E0B"],
          ["Done", "#22C55E"],
          ["Blocked", "#EF4444"],
        ].map(([label, color]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
            {label}
          </span>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : !projectId ? (
        <EmptyState icon={GanttChartSquare} title="No projects yet" description="Create a project first." />
      ) : projectEntries.length === 0 ? (
        <EmptyState
          icon={GanttChartSquare}
          title="No tasks scheduled"
          description={
            schedulableTasks.length === 0
              ? "This project has no tasks yet — create some on the Tasks page first."
              : "Schedule a task to start building out this project's timeline."
          }
          actionLabel={canManageGantt && schedulableTasks.length > 0 ? "Schedule Task" : undefined}
          onAction={canManageGantt && schedulableTasks.length > 0 ? openCreate : undefined}
        />
      ) : (
        <GanttChart entries={projectEntries} taskMap={taskMap} userMap={userMap} taskLinks={projectTaskLinks} onEdit={canManageGantt ? openEdit : undefined} onDelete={canManageGantt ? setDeletingEntry : undefined} />
      )}

      {canManageGantt && <GanttFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        entry={editingEntry}
        projectId={projectId}
        schedulableTasks={schedulableTasks}
        allProjectTasks={projectTasks}
        existingEntries={projectEntries}
      />}

      {canManageGantt && <ConfirmDialog
        open={!!deletingEntry}
        onOpenChange={(open) => !open && setDeletingEntry(null)}
        title="Remove from timeline?"
        description="This only removes the task from the Gantt chart — the task itself won't be deleted."
        confirmLabel="Remove"
        onConfirm={confirmDelete}
        isLoading={deleteMutation.isPending}
      />}
    </div>
  );
}
