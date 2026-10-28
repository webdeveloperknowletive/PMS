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
import { KanbanLabelColorPicker } from "@/components/modules/kanban/kanban-label-color-picker";
import { useCreateTask, useProjectAssigneeCandidates, useUpdateTask } from "@/hooks/queries/use-tasks";
import { useProjectComponents, useProjectCustomFields, useProjectGoals, useProjectReleases, useProjects } from "@/hooks/queries/use-projects";
import { getApiErrorMessage } from "@/lib/api/client";
import type { Task } from "@/types/task";

const UNASSIGNED = "__unassigned__";
const NO_GOAL = "__no_goal__";
const NO_RELEASE = "__no_release__";
const NO_COMPONENT = "__no_component__";
const NO_CUSTOM_FIELD_VALUE = "__no_custom_field_value__";
const NO_REMINDER = "none";
const TASK_TYPES = ["EPIC", "STORY", "TASK", "BUG", "SPIKE"] as const;
const TASK_TYPE_VALUES = [...TASK_TYPES, "SUBTASK"] as const;

const schema = z.object({
  project_id: z.string().min(1, "Project is required"),
  goal_id: z.string().optional(),
  release_id: z.string().optional(),
  component_id: z.string().optional(),
  labels: z.string().max(839, "Labels must be 20 items or fewer").optional(),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
  task_name: z.string().trim().min(2, "Task name must have at least 2 characters").max(255, "Task name must be 255 characters or fewer"),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  task_type: z.enum(TASK_TYPE_VALUES),
  user_id: z.string().optional(),
  start_date: z.string().optional().refine((value) => {
    if (!value) return true;
    const date = new Date(`${value}T00:00:00`);
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Enter a valid start date"),
  due_date: z.string().min(1, "Due date is required").refine((value) => {
    const date = new Date(`${value}T00:00:00`);
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Enter a valid due date"),
  reminder_days_before: z.enum([NO_REMINDER, "0", "1", "2", "7"]),
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
  const { data: projects } = useProjects();
  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    control,
    reset,
    getValues,
    setValue,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      project_id: defaultProjectId ?? "",
      goal_id: NO_GOAL,
      release_id: NO_RELEASE,
      component_id: NO_COMPONENT,
      labels: "",
      custom_fields: {},
      task_name: "",
      status: "TODO",
      priority: "MEDIUM",
      task_type: "TASK",
      user_id: UNASSIGNED,
      start_date: "",
      due_date: "",
      reminder_days_before: NO_REMINDER,
      checklist_items: [],
    },
  });
  const selectedProjectId = useWatch({ control, name: "project_id" });
  const selectedTaskStartDate = useWatch({ control, name: "start_date" });
  const selectedTaskDueDate = useWatch({ control, name: "due_date" });
  const selectedLabels = useWatch({ control, name: "labels" }) ?? "";
  const selectedProject = projects?.find((project) => project.project_id === selectedProjectId);
  const { data: projectAssigneeCandidates = [], isLoading: assigneesLoading } = useProjectAssigneeCandidates(selectedProjectId);
  const assigneeOptions = [...new Map(projectAssigneeCandidates.map((member) => [member.user_id, member])).values()];
  const selectedGoalId = useWatch({ control, name: "goal_id" });
  const selectedReleaseId = useWatch({ control, name: "release_id" });
  const selectedComponentId = useWatch({ control, name: "component_id" });
  const { data: projectGoals = [], isFetched: goalsFetched } = useProjectGoals(selectedProjectId, isEditing);
  const { data: projectReleases = [], isFetched: releasesFetched } = useProjectReleases(selectedProjectId, isEditing);
  const { data: projectComponents = [], isFetched: componentsFetched } = useProjectComponents(selectedProjectId, isEditing);
  const { data: projectCustomFields = [], isFetched: customFieldsFetched } = useProjectCustomFields(selectedProjectId);
  const selectedAssigneeId = useWatch({ control, name: "user_id" });
  const assigneeTeam = assigneeOptions.find((member) => member.user_id === selectedAssigneeId);

  useEffect(() => {
    if (!isEditing && selectedProjectId) setValue("user_id", UNASSIGNED);
  }, [isEditing, selectedProjectId, setValue]);

  useEffect(() => {
    if (isEditing || selectedAssigneeId === UNASSIGNED || !selectedAssigneeId) return;
    if (!assigneeOptions.some((member) => member.user_id === selectedAssigneeId)) {
      setValue("user_id", UNASSIGNED);
    }
  }, [isEditing, selectedAssigneeId, assigneeOptions, setValue]);
  useEffect(() => {
    if (goalsFetched && selectedGoalId && selectedGoalId !== NO_GOAL && !projectGoals.some((goal) => goal.goal_id === selectedGoalId)) {
      setValue("goal_id", NO_GOAL);
    }
  }, [goalsFetched, projectGoals, selectedGoalId, setValue]);
  useEffect(() => {
    if (releasesFetched && selectedReleaseId && selectedReleaseId !== NO_RELEASE && !projectReleases.some((release) => release.release_id === selectedReleaseId)) {
      setValue("release_id", NO_RELEASE);
    }
  }, [projectReleases, releasesFetched, selectedReleaseId, setValue]);
  useEffect(() => {
    if (componentsFetched && selectedComponentId && selectedComponentId !== NO_COMPONENT && !projectComponents.some((component) => component.component_id === selectedComponentId)) {
      setValue("component_id", NO_COMPONENT);
    }
  }, [componentsFetched, projectComponents, selectedComponentId, setValue]);
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
              goal_id: task.goal_id ?? NO_GOAL,
              release_id: task.release_id ?? NO_RELEASE,
              component_id: task.component_id ?? NO_COMPONENT,
              labels: (task.labels ?? []).join(", "),
              custom_fields: task.custom_fields ?? {},
              task_name: task.task_name,
              status: task.status,
              priority: task.priority,
              task_type: task.task_type ?? "TASK",
              user_id: task.user_id ?? UNASSIGNED,
              start_date: task.start_date ?? "",
              due_date: task.due_date ?? "",
              reminder_days_before: task.reminder_days_before == null ? NO_REMINDER : String(task.reminder_days_before) as "0" | "1" | "2" | "7",
              checklist_items: task.checklist_items ?? [],
            }
          : {
              project_id: defaultProjectId ?? "",
              goal_id: NO_GOAL,
              release_id: NO_RELEASE,
              component_id: NO_COMPONENT,
              labels: "",
              custom_fields: {},
              task_name: "",
              status: "TODO",
              priority: "MEDIUM",
              task_type: "TASK",
              user_id: UNASSIGNED,
              start_date: "",
              due_date: "",
              reminder_days_before: NO_REMINDER,
              checklist_items: [],
            }
      );
    }
  }, [open, task, defaultProjectId, reset]);

  useEffect(() => {
    if (!open || !customFieldsFetched) return;
    const validIds = new Set(projectCustomFields.map((field) => field.field_id));
    const currentValues = getValues("custom_fields") ?? {};
    const retained = Object.fromEntries(Object.entries(currentValues).filter(([fieldId]) => validIds.has(fieldId)));
    const defaults = Object.fromEntries(projectCustomFields
      .filter((field) => field.default_value !== null && field.default_value !== undefined && !(field.field_id in retained))
      .map((field) => [field.field_id, field.default_value]));
    setValue("custom_fields", { ...defaults, ...retained }, { shouldDirty: false });
  }, [customFieldsFetched, getValues, open, projectCustomFields, selectedProjectId, setValue]);

  const onSubmit = async (values: FormValues) => {
    const labels = [...new Set((values.labels ?? "").split(",").map((label) => label.trim().toLocaleLowerCase()).filter(Boolean))];
    if (!isEditing && labels.length === 0) {
      setError("labels", { message: "Choose a task color before creating the task." });
      return;
    }
    if (labels.length > 20 || labels.some((label) => label.length > 40)) {
      setError("root", { message: "Use up to 20 labels, each 40 characters or fewer." });
      return;
    }
    if (selectedProject?.start_date && values.start_date && values.start_date < selectedProject.start_date) {
      setError("start_date", { message: "Start date must be on or after the project start date" });
      return;
    }
    if (selectedProject?.start_date && values.due_date < selectedProject.start_date) {
      setError("due_date", { message: "Due date must be on or after the project start date" });
      return;
    }
    if (values.start_date && values.due_date < values.start_date) {
      setError("due_date", { message: "Due date must be on or after the task start date" });
      return;
    }
    for (const field of projectCustomFields) {
      const value = values.custom_fields?.[field.field_id] ?? field.default_value;
      const isBlankString = typeof value === "string" && !value.trim();
      if (field.is_required && (value === null || value === undefined || isBlankString || (field.field_type === "CHECKBOX" && value !== true))) {
        setError("root", { message: `${field.name} is required` });
        return;
      }
    }
    const taskFields = {
      task_name: values.task_name,
      goal_id: values.goal_id && values.goal_id !== NO_GOAL ? values.goal_id : null,
      release_id: values.release_id && values.release_id !== NO_RELEASE ? values.release_id : null,
      component_id: values.component_id && values.component_id !== NO_COMPONENT ? values.component_id : null,
      labels,
      custom_fields: values.custom_fields ?? {},
      status: values.status,
      priority: values.priority,
      task_type: values.task_type,
      user_id: values.user_id === UNASSIGNED ? null : values.user_id,
      start_date: values.start_date || null,
      due_date: values.due_date || null,
      reminder_days_before: values.due_date && values.reminder_days_before !== NO_REMINDER
        ? Number(values.reminder_days_before) as 0 | 1 | 2 | 7
        : null,
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
                <Select value={field.value} onValueChange={field.onChange} disabled={isEditing}>
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

          {isEditing && <div className="space-y-1.5">
            <Label>Goal</Label>
            <Controller control={control} name="goal_id" render={({ field }) => (
              <Select value={field.value || NO_GOAL} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue placeholder="No goal" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_GOAL}>No goal</SelectItem>
                  {projectGoals.map((goal) => <SelectItem key={goal.goal_id} value={goal.goal_id}>{goal.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )} />
            {selectedGoalId && selectedGoalId !== NO_GOAL && !projectGoals.some((goal) => goal.goal_id === selectedGoalId) && <p className="text-xs text-muted-foreground">The linked goal is not currently available.</p>}
          </div>}

          {isEditing && <div className="space-y-1.5">
            <Label>Release</Label>
            <Controller control={control} name="release_id" render={({ field }) => (
              <Select value={field.value || NO_RELEASE} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue placeholder="No release" /></SelectTrigger>
                <SelectContent><SelectItem value={NO_RELEASE}>No release</SelectItem>{projectReleases.map((release) => <SelectItem key={release.release_id} value={release.release_id}>{release.name}{release.version ? ` · ${release.version}` : ""}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </div>}

          {isEditing && <div className="space-y-1.5">
            <Label>Component</Label>
            <Controller control={control} name="component_id" render={({ field }) => (
              <Select value={field.value || NO_COMPONENT} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue placeholder="No component" /></SelectTrigger>
                <SelectContent><SelectItem value={NO_COMPONENT}>No component</SelectItem>{projectComponents.map((component) => <SelectItem key={component.component_id} value={component.component_id}>{component.name}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </div>}

          <div className="space-y-1.5">
            <KanbanLabelColorPicker value={selectedLabels.split(",")[0]?.trim().toLocaleLowerCase() ?? ""} onChange={(labelKey) => setValue("labels", labelKey, { shouldDirty: true, shouldValidate: true })} required={!isEditing} />
            {errors.labels && <p className="text-xs text-destructive">{errors.labels.message}</p>}
          </div>

          {projectCustomFields.map((customField) => <div key={customField.field_id} className="space-y-1.5">
            <Label htmlFor={`custom-field-${customField.field_id}`}>{customField.name}{customField.is_required ? " *" : ""}</Label>
            <Controller control={control} name={`custom_fields.${customField.field_id}`} render={({ field }) => {
              if (customField.field_type === "CHECKBOX") return <label className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm"><Checkbox checked={field.value === true} onCheckedChange={(checked) => field.onChange(checked === true)} />{customField.name}</label>;
              if (customField.field_type === "SINGLE_SELECT") return <Select value={typeof field.value === "string" && field.value ? field.value : NO_CUSTOM_FIELD_VALUE} onValueChange={(value) => field.onChange(value === NO_CUSTOM_FIELD_VALUE ? "" : value)}><SelectTrigger aria-label={customField.name}><SelectValue placeholder="Choose a value" /></SelectTrigger><SelectContent><SelectItem value={NO_CUSTOM_FIELD_VALUE}>No value</SelectItem>{customField.options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>;
              return <Input id={`custom-field-${customField.field_id}`} type={customField.field_type === "NUMBER" ? "number" : customField.field_type === "DATE" ? "date" : "text"} step={customField.field_type === "NUMBER" ? "any" : undefined} maxLength={customField.field_type === "TEXT" ? 1000 : undefined} required={customField.is_required} value={field.value === undefined || field.value === null ? "" : String(field.value)} onChange={(event) => field.onChange(customField.field_type === "NUMBER" ? event.target.value === "" ? "" : Number(event.target.value) : event.target.value)} aria-invalid={!!errors.root} />;
            }} />
          </div>)}

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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="start_date">Start date</Label>
              <Input id="start_date" type="date" min={selectedProject?.start_date ?? undefined} aria-invalid={!!errors.start_date} {...register("start_date")} />
              {errors.start_date && <p className="text-xs text-destructive">{errors.start_date.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="due_date">Due date</Label>
              <Input id="due_date" type="date" min={selectedTaskStartDate || selectedProject?.start_date || undefined} required aria-invalid={!!errors.due_date} {...register("due_date")} />
              {errors.due_date && <p className="text-xs text-destructive">{errors.due_date.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Assignee</Label>
              <Controller
                control={control}
                name="user_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={!selectedProjectId || assigneesLoading}>
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
                          {user.name} ({user.role_name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-muted-foreground">
                {!selectedProjectId ? "Select a project to load its developers." : assigneesLoading ? "Loading project developers…" : assigneeOptions.length ? "Only developers assigned to a team in this project are listed." : "No developers are assigned to a team in this project yet."}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>In-app deadline reminder</Label>
            <Controller control={control} name="reminder_days_before" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger disabled={!selectedTaskDueDate}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_REMINDER}>No reminder</SelectItem>
                  <SelectItem value="0">On the due date</SelectItem>
                  <SelectItem value="1">1 day before</SelectItem>
                  <SelectItem value="2">2 days before</SelectItem>
                  <SelectItem value="7">1 week before</SelectItem>
                </SelectContent>
              </Select>
            )} />
            <p className="text-xs text-muted-foreground">Notifies the task assignee and assigned card members in the app. Choose a due date first.</p>
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
