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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateMilestone, useUpdateMilestone } from "@/hooks/queries/use-milestones";
import { useProjects } from "@/hooks/queries/use-projects";
import { getApiErrorMessage } from "@/lib/api/client";
import type { Milestone } from "@/types/milestone";

const schema = z.object({
  project_id: z.string().min(1, "Project is required"),
  title: z.string().min(2, "Title is required"),
  description: z.string().optional(),
  due_date: z.string().min(1, "Due date is required"),
  is_completed: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

export function MilestoneFormDialog({
  open,
  onOpenChange,
  milestone,
  defaultProjectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  milestone?: Milestone | null;
  defaultProjectId?: string;
}) {
  const isEditing = !!milestone;
  const { data: projects } = useProjects();
  const createMutation = useCreateMilestone();
  const updateMutation = useUpdateMilestone();
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
      title: "",
      description: "",
      due_date: "",
      is_completed: false,
    },
  });

  useEffect(() => {
    if (open) {
      reset(
        milestone
          ? {
              project_id: milestone.project_id,
              title: milestone.title,
              description: milestone.description ?? "",
              due_date: milestone.due_date,
              is_completed: milestone.is_completed,
            }
          : { project_id: defaultProjectId ?? "", title: "", description: "", due_date: "", is_completed: false }
      );
    }
  }, [open, milestone, defaultProjectId, reset]);

  const onSubmit = async (values: FormValues) => {
    const payload = { ...values, description: values.description || null };
    try {
      if (isEditing && milestone) {
        await updateMutation.mutateAsync({ id: milestone.milestone_id, payload });
        toast.success("Milestone updated");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Milestone created");
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
          <DialogTitle>{isEditing ? "Edit Milestone" : "New Milestone"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update this milestone's details." : "Add a new milestone to track project progress."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" placeholder="e.g. Beta Release" {...register("title")} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" placeholder="What does this milestone represent?" {...register("description")} />
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

          <div className="space-y-1.5">
            <Label htmlFor="due_date">Due date</Label>
            <Input id="due_date" type="date" {...register("due_date")} />
            {errors.due_date && <p className="text-xs text-destructive">{errors.due_date.message}</p>}
          </div>

          <Controller
            control={control}
            name="is_completed"
            render={({ field }) => (
              <label className="flex items-center gap-2 text-sm text-foreground">
                <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(!!v)} />
                Mark as completed
              </label>
            )}
          />

          {errors.root && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{errors.root.message}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? "Save changes" : "Create milestone"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
