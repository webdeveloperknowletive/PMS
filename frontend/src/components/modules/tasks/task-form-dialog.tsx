"use client";

import { useEffect } from "react";
import { useForm, Controller, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TASK_PRIORITIES, TASK_STATUSES, PRIORITY_LABEL, TASK_STATUS_LABEL } from "@/lib/constants";
import { useCreateTask, useUpdateTask } from "@/hooks/queries/use-tasks";
import { useProjects } from "@/hooks/queries/use-projects";
import { useTeamMemberCandidates, useTeams } from "@/hooks/queries/use-teams";
import { visibleMemberPostForRoleNames } from "@/lib/member-visibility";
import { usePermissions } from "@/hooks/use-permissions";
import { getApiErrorMessage } from "@/lib/api/client";
import type { Task } from "@/types/task";

const UNASSIGNED = "__unassigned__";
const TASK_TYPES = ["EPIC", "STORY", "TASK", "BUG"] as const;
const TASK_TYPE_VALUES = [...TASK_TYPES, "SUBTASK"] as const;

const schema = z.object({
  project_id: z.string().min(1, "Project is required"),
  task_name: z.string().trim().min(2, "Task name must have at least 2 characters").max(255, "Task name must be 255 characters or fewer"),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  task_type: z.enum(TASK_TYPE_VALUES),
  user_id: z.string().optional(),
  due_date: z.string().min(1, "Due date is required").refine((value) => {
    const date = new Date(`${value}T00:00:00`);
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Enter a valid due date"),
  checklist_items: z.array(z.object({
    item_id: z.string(),
    text: z.string(),
    is_completed: z.boolean(),
  })).default([]),
});
type FormValues = z.infer<typeof schema>;

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  defaultProjectId,
  kanbanCardEdit = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  defaultProjectId?: string;
  /** Keep a card edit on its current project and change its status by dragging. */
  kanbanCardEdit?: boolean;
}) {
  const isEditing = !!task;
  const { permissionCodes } = usePermissions();
  const canViewTeamMembers = ["teams.view", "teams.create", "teams.update", "teams.delete", "teams.manage", "teams.members.view", "teams.members.manage", "teams.leads.view"].some((code) => permissionCodes.includes(code));
  const { data: projects } = useProjects();
  const { data: teams = [] } = useTeams(canViewTeamMembers);
  const { data: teamMemberCandidates = [] } = useTeamMemberCandidates(canViewTeamMembers);
  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      project_id: defaultProjectId ?? "",
      task_name: "",
      status: "TODO",
      priority: "MEDIUM",
      task_type: "TASK",
      user_id: UNASSIGNED,
      due_date: "",
      checklist_items: [],
    },
  });
  const selectedProjectId = useWatch({ control, name: "project_id" });
  const selectedAssigneeId = useWatch({ control, name: "user_id" });
  const projectTeams = teams.filter((team) => team.project_id === selectedProjectId);
  const projectMemberIds = new Set(projectTeams.flatMap((team) => (team.members ?? []).map((member) => member.user_id)));
  const assigneeOptions = teamMemberCandidates.filter((member) => projectMemberIds.has(member.user_id));
  const assigneeTeam = projectTeams.find((team) => team.members?.some((member) => member.user_id === selectedAssigneeId));

  useEffect(() => {
    if (isEditing || selectedAssigneeId === UNASSIGNED || !selectedAssigneeId) return;
    if (!assigneeOptions.some((member) => member.user_id === selectedAssigneeId)) {
      setValue("user_id", UNASSIGNED);
    }
  }, [isEditing, selectedAssigneeId, assigneeOptions, setValue]);
  const { fields: checklistFields, append: appendChecklist, remove: removeChecklist } = useFieldArray({
    control,
    name: "checklist_items",
  });
  const taskTypeOptions = task?.task_type === "SUBTASK" ? TASK_TYPE_VALUES : TASK_TYPES;

  useEffect(() => {
    if (open) {
      reset(
        task
          ? {
              project_id: task.project_id,
              task_name: task.task_name,
              status: task.status,
              priority: task.priority,
              task_type: task.task_type ?? "TASK",
              user_id: task.user_id ?? UNASSIGNED,
              due_date: task.due_date ?? "",
              checklist_items: task.checklist_items ?? [],
            }
          : {
              project_id: defaultProjectId ?? "",
              task_name: "",
              status: "TODO",
              priority: "MEDIUM",
              task_type: "TASK",
              user_id: UNASSIGNED,
              due_date: "",
              checklist_items: [],
            }
      );
    }
  }, [open, task, defaultProjectId, reset]);

  const onSubmit = async (values: FormValues) => {
    const selectedProject = projects?.find((project) => project.project_id === values.project_id);
    if (selectedProject?.start_date && values.due_date < selectedProject.start_date) {
      setError("due_date", { message: "Due date must be on or after the project start date" });
      return;
    }
    const taskFields = {
      task_name: values.task_name,
      status: values.status,
      priority: values.priority,
      task_type: values.task_type,
      user_id: values.user_id === UNASSIGNED ? null : values.user_id,
      due_date: values.due_date || null,
      checklist_items: values.checklist_items
        .map((item) => ({ ...item, text: item.text.trim() }))
        .filter((item) => item.text.length > 0),
    };
    try {
      if (isEditing && task) {
        await updateMutation.mutateAsync({ id: task.task_id, payload: taskFields });
        toast.success("Task updated");
      } else {
        await createMutation.mutateAsync({ project_id: values.project_id, team_id: assigneeTeam?.team_id ?? null, ...taskFields });
        toast.success("Task created");
      }
      onOpenChange(false);
    } catch (err) {
      setError("root", { message: getApiErrorMessage(err) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Task" : "New Task"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update this task's details." : "Add a new task to a project."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="task_name">Task name</Label>
            <Input id="task_name" placeholder="Design homepage UI" required maxLength={255} aria-invalid={!!errors.task_name} {...register("task_name")} />
            {errors.task_name && <p className="text-xs text-destructive">{errors.task_name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <div className="space-y-1.5">
              <Label>Work type</Label>
              <Controller control={control} name="task_type" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  {taskTypeOptions.map((type) => <SelectItem key={type} value={type}>{type.charAt(0) + type.slice(1).toLowerCase()}</SelectItem>)}
                </SelectContent></Select>
              )} />
            </div>
          </div>

          {!kanbanCardEdit && !defaultProjectId && <div className="space-y-1.5">
            <Label>Project</Label>
            <Controller
              control={control}
              name="project_id"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
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
              )}
            />
            {errors.project_id && <p className="text-xs text-destructive">{errors.project_id.message}</p>}
          </div>}

          <div className="grid grid-cols-2 gap-4">
            {!kanbanCardEdit && <div className="space-y-1.5">
              <Label>Status</Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {TASK_STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>}

            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
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
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Assignee</Label>
              <Controller
                control={control}
                name="user_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                      {task?.user_id && !assigneeOptions.some((user) => user.user_id === task.user_id) && (
                        <SelectItem value={task.user_id}>
                          {task.assignee_name ?? "Assigned member"} (current assignee)
                        </SelectItem>
                      )}
                      {assigneeOptions.map((user) => (
                        <SelectItem key={user.user_id} value={user.user_id}>
                          {user.name} ({visibleMemberPostForRoleNames(user.role_names)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-muted-foreground">Only members assigned to a team in the selected project are listed.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="due_date">Due date</Label>
              <Input id="due_date" type="date" required aria-invalid={!!errors.due_date} {...register("due_date")} />
              {errors.due_date && <p className="text-xs text-destructive">{errors.due_date.message}</p>}
            </div>
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <Label>Task checklist</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">Checklist items appear on the assigned member’s task card.</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => appendChecklist({
                item_id: crypto.randomUUID(),
                text: "",
                is_completed: false,
              })}>
                <Plus className="h-3.5 w-3.5" /> Add item
              </Button>
            </div>
            {checklistFields.length === 0 ? (
              <p className="text-xs text-muted-foreground">No checklist items added.</p>
            ) : checklistFields.map((item, index) => (
              <div key={item.id} className="flex items-center gap-2">
                <Controller
                  control={control}
                  name={`checklist_items.${index}.is_completed`}
                  render={({ field }) => <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} aria-label={`Mark checklist item ${index + 1} complete`} />}
                />
                <Input
                  aria-label={`Checklist item ${index + 1}`}
                  placeholder={`Checklist item ${index + 1}`}
                  {...register(`checklist_items.${index}.text`)}
                />
                <Button type="button" size="icon" variant="ghost" aria-label={`Remove checklist item ${index + 1}`} onClick={() => removeChecklist(index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {errors.root && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{errors.root.message}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? "Save changes" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
