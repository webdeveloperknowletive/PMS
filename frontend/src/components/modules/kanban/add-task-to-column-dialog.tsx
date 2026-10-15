"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { useCreateKanbanTaskPlacement } from "@/hooks/queries/use-kanban";
import { useCreateTask } from "@/hooks/queries/use-tasks";
import { useAvailableTeamMembers, useTeamLeads, useTeams } from "@/hooks/queries/use-teams";
import { useAuthStore } from "@/store/auth-store";
import { getApiErrorMessage } from "@/lib/api/client";
import { TASK_PRIORITIES, PRIORITY_LABEL, COLUMN_NAME_TO_STATUS, type TaskPriority } from "@/lib/constants";
import type { Task, TaskType } from "@/types/task";

export function AddTaskToColumnDialog({
  open,
  onOpenChange,
  columnId,
  columnName,
  projectId,
  unplacedTasks,
  nextPosition,
  canCreateTask,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columnId: string | null;
  columnName?: string;
  projectId: string;
  unplacedTasks: Task[];
  nextPosition: number;
  canCreateTask: boolean;
}) {
  const [mode, setMode] = useState<"existing" | "create">(canCreateTask ? "create" : "existing");
  const [search, setSearch] = useState("");
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>("MEDIUM");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [newTaskType, setNewTaskType] = useState<TaskType>("TASK");
  const [checklistDrafts, setChecklistDrafts] = useState<string[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");

  const currentUser = useAuthStore((state) => state.user);
  const { data: teams = [] } = useTeams(open);
  const { data: teamLeads = [] } = useTeamLeads(open);
  const isTeamLead = currentUser?.role_names?.some((role) => role.trim().toLowerCase() === "team lead") ?? false;
  const currentTeamLeadId = teamLeads.find((lead) => lead.user_id === currentUser?.user_id)?.team_lead_id;
  const projectTeams = teams.filter((team) => team.project_id === projectId);
  const assignableTeams = isTeamLead && currentTeamLeadId
    ? projectTeams.filter((team) => team.team_lead_id === currentTeamLeadId)
    : projectTeams;
  const selectedTeam = assignableTeams.find((team) => team.team_id === selectedTeamId) ?? assignableTeams[0];
  const { data: availableMembers = [], isLoading: membersLoading } = useAvailableTeamMembers(
    selectedTeam?.team_id,
    open && mode === "create",
  );
  const createPlacement = useCreateKanbanTaskPlacement();
  const createTask = useCreateTask();

  const filtered = unplacedTasks.filter((t) => t.task_name.toLowerCase().includes(search.toLowerCase()));

  const reset = () => {
    setSearch("");
    setNewTaskName("");
    setNewTaskPriority("MEDIUM");
    setNewTaskDueDate("");
    setAssigneeId("");
    setNewTaskType("TASK");
    setChecklistDrafts([]);
    setSelectedTeamId("");
    setMode(canCreateTask ? "create" : "existing");
  };

  useEffect(() => {
    if (selectedTeamId && !assignableTeams.some((team) => team.team_id === selectedTeamId)) {
      setSelectedTeamId("");
      setAssigneeId("");
    }
  }, [assignableTeams, selectedTeamId]);

  useEffect(() => {
    if (!availableMembers.some((member) => member.user_id === assigneeId)) setAssigneeId("");
  }, [availableMembers, assigneeId]);

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
   * Create the task and its board placement in one request so every task
   * appears exactly once on the selected project's board.
   */
  const handleCreateAndAdd = async () => {
    if (!newTaskName.trim()) {
      toast.error("Task name is required.");
      return;
    }
    if (!newTaskDueDate) {
      toast.error("Due date is required.");
      return;
    }
    if (!columnId || !selectedTeam || !availableMembers.some((member) => member.user_id === assigneeId)) return;
    try {
      const status = (columnName && COLUMN_NAME_TO_STATUS[columnName]) || "TODO";
      const task = await createTask.mutateAsync({
        project_id: projectId,
        team_id: selectedTeam.team_id,
        kanban_column_id: columnId,
        kanban_position: nextPosition,
        task_name: newTaskName.trim(),
        status,
        priority: newTaskPriority,
        due_date: newTaskDueDate || null,
        user_id: assigneeId,
        task_type: newTaskType,
        checklist_items: checklistDrafts.map((text) => text.trim()).filter(Boolean).map((text) => ({
          item_id: crypto.randomUUID(),
          text,
          is_completed: false,
        })),
      });
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
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add task to board</DialogTitle>
          <DialogDescription>
            Create a new task, or attach one that already exists in this project.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 rounded-lg bg-muted p-1">
          {canCreateTask && <button
            onClick={() => setMode("create")}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              mode === "create" ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            Create New
          </button>}
          <button
            onClick={() => setMode("existing")}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              mode === "existing" ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            Existing Tasks
          </button>
        </div>

        {mode === "create" && canCreateTask ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-task-name">Task name</Label>
              <Input
                id="new-task-name"
                placeholder="e.g. Fix login redirect bug"
                value={newTaskName}
                required
                maxLength={255}
                onChange={(e) => setNewTaskName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newTaskName.trim()) handleCreateAndAdd();
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Work type</Label>
                <Select value={newTaskType} onValueChange={(value) => setNewTaskType(value as TaskType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["EPIC", "STORY", "TASK", "BUG"].map((type) => <SelectItem key={type} value={type}>{type.charAt(0) + type.slice(1).toLowerCase()}</SelectItem>)}</SelectContent>
                </Select>
              </div>
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
                  required
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                />
              </div>
            </div>

            {assignableTeams.length > 1 && <div className="space-y-1.5">
              <Label>Team</Label>
              <Select value={selectedTeam?.team_id ?? ""} onValueChange={(teamId) => { setSelectedTeamId(teamId); setAssigneeId(""); }}>
                <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                <SelectContent>
                  {assignableTeams.map((team) => <SelectItem key={team.team_id} value={team.team_id}>{team.team_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>}

            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <div><Label>Task checklist</Label><p className="mt-0.5 text-xs text-muted-foreground">Checklist items will appear on the assigned member’s task card.</p></div>
                <Button type="button" size="sm" variant="outline" onClick={() => setChecklistDrafts((items) => [...items, ""])}><Plus className="h-3.5 w-3.5" /> Add item</Button>
              </div>
              {checklistDrafts.map((item, index) => <div key={index} className="flex items-center gap-2">
                <Input aria-label={`Checklist item ${index + 1}`} placeholder={`Checklist item ${index + 1}`} value={item} onChange={(event) => setChecklistDrafts((items) => items.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} />
                <Button type="button" size="icon" variant="ghost" aria-label={`Remove checklist item ${index + 1}`} onClick={() => setChecklistDrafts((items) => items.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" /></Button>
              </div>)}
            </div>

            <div className="space-y-1.5">
              <Label>Assign to</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId} disabled={!selectedTeam || membersLoading}>
                <SelectTrigger><SelectValue placeholder={membersLoading ? "Loading available members…" : "Select an available team member"} /></SelectTrigger>
                <SelectContent>
                  {availableMembers.map((member) => <SelectItem key={member.user_id} value={member.user_id}>{member.name}</SelectItem>)}
                  {!membersLoading && availableMembers.length === 0 && <SelectItem value="__no_available_members__" disabled>No available team members</SelectItem>}
                </SelectContent>
              </Select>
              {!selectedTeam && <p className="text-xs text-muted-foreground">No team is assigned to you for this project.</p>}
              {selectedTeam && !membersLoading && availableMembers.length === 0 && <p className="text-xs text-muted-foreground">Every member on this team has unfinished work.</p>}
            </div>

            <Button className="w-full" disabled={!selectedTeam || !assigneeId || isSaving} onClick={handleCreateAndAdd}>
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
