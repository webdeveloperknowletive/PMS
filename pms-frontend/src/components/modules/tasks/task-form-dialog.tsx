"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useUsers } from "@/hooks/queries/use-users";
import { getApiErrorMessage } from "@/lib/api/client";
import type { Task } from "@/types/task";

const UNASSIGNED = "__unassigned__";

const schema = z.object({
  project_id: z.string().min(1, "Project is required"),
  task_name: z.string().min(2, "Task name is required"),
  description: z.string().optional(),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  user_id: z.string().optional(),
  due_date: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  defaultProjectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  defaultProjectId?: string;
}) {
  const isEditing = !!task;
  const { data: projects } = useProjects();
  const { data: users } = useUsers();
  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      project_id: defaultProjectId ?? "",
      task_name: "",
      description: "",
      status: "TODO",
      priority: "MEDIUM",
      user_id: UNASSIGNED,
      due_date: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset(
        task
          ? {
              project_id: task.project_id,
              task_name: task.task_name,
              description: task.description ?? "",
              status: task.status,
              priority: task.priority,
              user_id: task.user_id ?? UNASSIGNED,
              due_date: task.due_date ?? "",
            }
          : {
              project_id: defaultProjectId ?? "",
              task_name: "",
              description: "",
              status: "TODO",
              priority: "MEDIUM",
              user_id: UNASSIGNED,
              due_date: "",
            }
      );
    }
  }, [open, task, defaultProjectId, reset]);

  const onSubmit = async (values: FormValues) => {
    const payload = {
      ...values,
      user_id: values.user_id === UNASSIGNED ? null : values.user_id,
      due_date: values.due_date || null,
      description: values.description || null,
    };
    try {
      if (isEditing && task) {
        await updateMutation.mutateAsync({ id: task.task_id, payload });
        toast.success("Task updated");
      } else {
        await createMutation.mutateAsync(payload as never);
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
            <Input id="task_name" placeholder="Design homepage UI" {...register("task_name")} />
            {errors.task_name && <p className="text-xs text-destructive">{errors.task_name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" placeholder="What needs to be done?" {...register("description")} />
          </div>

          <div className="space-y-1.5">
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
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
            </div>

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
                      {(users ?? []).map((u) => (
                        <SelectItem key={u.user_id} value={u.user_id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="due_date">Due date</Label>
              <Input id="due_date" type="date" {...register("due_date")} />
            </div>
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
