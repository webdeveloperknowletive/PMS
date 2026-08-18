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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateGanttTask, useUpdateGanttTask } from "@/hooks/queries/use-gantt";
import { getApiErrorMessage } from "@/lib/api/client";
import type { GanttTask } from "@/types/gantt";
import type { Task } from "@/types/task";

const NO_DEPENDENCY = "__none__";

const schema = z
  .object({
    task_id: z.string().min(1, "Task is required"),
    start_date: z.string().min(1, "Start date is required"),
    end_date: z.string().min(1, "End date is required"),
    progress: z.coerce.number().min(0).max(100),
    dependency_task: z.string().optional(),
  })
  .refine((data) => data.end_date >= data.start_date, {
    message: "End date must be on or after the start date",
    path: ["end_date"],
  });
type FormValues = z.infer<typeof schema>;

export function GanttFormDialog({
  open,
  onOpenChange,
  entry,
  projectId,
  schedulableTasks,
  allProjectTasks,
  existingEntries,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: GanttTask | null;
  projectId: string;
  schedulableTasks: Task[]; // tasks in this project not yet on the Gantt chart
  allProjectTasks: Task[]; // every task in the project, used to label dependency options
  existingEntries: GanttTask[]; // other Gantt entries in this project, for the dependency picker
}) {
  const isEditing = !!entry;
  const createMutation = useCreateGanttTask();
  const updateMutation = useUpdateGanttTask();
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
    defaultValues: { task_id: "", start_date: "", end_date: "", progress: 0, dependency_task: NO_DEPENDENCY },
  });

  useEffect(() => {
    if (open) {
      reset(
        entry
          ? {
              task_id: entry.task_id,
              start_date: entry.start_date,
              end_date: entry.end_date,
              progress: entry.progress,
              dependency_task: entry.dependency_task ?? NO_DEPENDENCY,
            }
          : { task_id: "", start_date: "", end_date: "", progress: 0, dependency_task: NO_DEPENDENCY }
      );
    }
  }, [open, entry, reset]);

  const onSubmit = async (values: FormValues) => {
    const payload = {
      project_id: projectId,
      task_id: values.task_id,
      start_date: values.start_date,
      end_date: values.end_date,
      progress: values.progress,
      dependency_task: values.dependency_task === NO_DEPENDENCY ? null : values.dependency_task,
    };
    try {
      if (isEditing && entry) {
        await updateMutation.mutateAsync({ id: entry.gantt_id, payload });
        toast.success("Schedule updated");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Task scheduled");
      }
      onOpenChange(false);
    } catch (err) {
      setError("root", { message: getApiErrorMessage(err) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Schedule" : "Schedule Task"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update this task's timeline." : "Add an existing task to the Gantt chart with a start and end date."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Task</Label>
            <Controller
              control={control}
              name="task_id"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={isEditing}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select task" />
                  </SelectTrigger>
                  <SelectContent>
                    {(isEditing
                      ? allProjectTasks.filter((t) => t.task_id === entry?.task_id)
                      : schedulableTasks
                    ).map((t) => (
                      <SelectItem key={t.task_id} value={t.task_id}>
                        {t.task_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.task_id && <p className="text-xs text-destructive">{errors.task_id.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="start_date">Start date</Label>
              <Input id="start_date" type="date" {...register("start_date")} />
              {errors.start_date && <p className="text-xs text-destructive">{errors.start_date.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end_date">End date</Label>
              <Input id="end_date" type="date" {...register("end_date")} />
              {errors.end_date && <p className="text-xs text-destructive">{errors.end_date.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="progress">Progress (%)</Label>
            <Input id="progress" type="number" min={0} max={100} {...register("progress")} />
          </div>

          <div className="space-y-1.5">
            <Label>Depends on</Label>
            <Controller
              control={control}
              name="dependency_task"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="No dependency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_DEPENDENCY}>No dependency</SelectItem>
                    {existingEntries
                      .filter((e) => e.gantt_id !== entry?.gantt_id)
                      .map((e) => (
                        <SelectItem key={e.gantt_id} value={e.gantt_id}>
                          {allProjectTasks.find((t) => t.task_id === e.task_id)?.task_name ?? "Task"}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            />
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
              {isEditing ? "Save changes" : "Schedule task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
