"use client";

import { useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { useCreateKanbanTaskPlacement } from "@/hooks/queries/use-kanban";
import { useCreateTask } from "@/hooks/queries/use-tasks";
import { getApiErrorMessage } from "@/lib/api/client";
import { TASK_PRIORITIES, PRIORITY_LABEL, COLUMN_NAME_TO_STATUS, type TaskPriority } from "@/lib/constants";
import type { Task } from "@/types/task";

export function AddTaskToColumnDialog({
  open,
  onOpenChange,
  columnId,
  columnName,
  projectId,
  unplacedTasks,
  nextPosition,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columnId: string | null;
  columnName?: string;
  projectId: string;
  unplacedTasks: Task[];
  nextPosition: number;
}) {
  const [mode, setMode] = useState<"existing" | "create">("create");
  const [search, setSearch] = useState("");
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>("MEDIUM");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");

  const createPlacement = useCreateKanbanTaskPlacement();
  const createTask = useCreateTask();

  const filtered = unplacedTasks.filter((t) => t.task_name.toLowerCase().includes(search.toLowerCase()));

  const reset = () => {
    setSearch("");
    setNewTaskName("");
    setNewTaskPriority("MEDIUM");
    setNewTaskDueDate("");
    setMode("create");
  };

  const handleAddExisting = async (task: Task) => {
    if (!columnId) return;
    try {
      await createPlacement.mutateAsync({ task_id: task.task_id, column_id: columnId, position: nextPosition });
      toast.success(`"${task.task_name}" added to board`);
      onOpenChange(false);
      reset();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  /**
   * Creates a brand-new task, then immediately places it on this Kanban
   * column. Two API calls under the hood (POST /tasks then POST
   * /kanban/tasks) since the backend has no combined "create + place"
   * endpoint. Status is pre-set to whatever this column maps to (see
   * COLUMN_NAME_TO_STATUS) so a card created in "Done" isn't left as TODO.
   */
  const handleCreateAndAdd = async () => {
    if (!columnId || !newTaskName.trim()) return;
    try {
      const status = (columnName && COLUMN_NAME_TO_STATUS[columnName]) || "TODO";
      const task = await createTask.mutateAsync({
        project_id: projectId,
        task_name: newTaskName.trim(),
        status,
        priority: newTaskPriority,
        due_date: newTaskDueDate || null,
      });
      await createPlacement.mutateAsync({ task_id: task.task_id, column_id: columnId, position: nextPosition });
      toast.success(`"${task.task_name}" created and added to board`);
      onOpenChange(false);
      reset();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const isSaving = createTask.isPending || createPlacement.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add task to board</DialogTitle>
          <DialogDescription>
            Create a new task, or attach one that already exists in this project.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 rounded-lg bg-muted p-1">
          <button
            onClick={() => setMode("create")}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              mode === "create" ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            Create New
          </button>
          <button
            onClick={() => setMode("existing")}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              mode === "existing" ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            Existing Tasks
          </button>
        </div>

        {mode === "create" ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-task-name">Task name</Label>
              <Input
                id="new-task-name"
                placeholder="e.g. Fix login redirect bug"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newTaskName.trim()) handleCreateAndAdd();
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={newTaskPriority} onValueChange={(v) => setNewTaskPriority(v as TaskPriority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRIORITY_LABEL[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-task-due">Due date</Label>
                <Input
                  id="new-task-due"
                  type="date"
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                />
              </div>
            </div>

            <Button className="w-full" disabled={!newTaskName.trim() || isSaving} onClick={handleCreateAndAdd}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create &amp; add to {columnName ?? "column"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="max-h-72 space-y-1 overflow-y-auto scrollbar-thin">
              {filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {unplacedTasks.length === 0
                    ? "All tasks in this project are already on the board."
                    : "No matching tasks."}
                </p>
              ) : (
                filtered.map((task) => (
                  <button
                    key={task.task_id}
                    onClick={() => handleAddExisting(task)}
                    disabled={isSaving}
                    className="flex w-full items-center justify-between rounded-lg border border-transparent px-3 py-2 text-left hover:border-border hover:bg-muted/50 disabled:opacity-50"
                  >
                    <span className="text-sm text-foreground">{task.task_name}</span>
                    <span className="flex items-center gap-2">
                      {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      <PriorityBadge priority={task.priority} />
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}