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
import { PROJECT_STATUSES } from "@/lib/constants";
import { useCreateProject, useUpdateProject } from "@/hooks/queries/use-projects";
import { getApiErrorMessage } from "@/lib/api/client";
import type { Project } from "@/types/project";

const schema = z.object({
  project_name: z.string().min(2, "Project name is required"),
  description: z.string().optional(),
  status: z.enum(PROJECT_STATUSES),
});
type FormValues = z.infer<typeof schema>;

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project | null;
}) {
  const isEditing = !!project;
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();
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
    defaultValues: { project_name: "", description: "", status: "ACTIVE" },
  });

  useEffect(() => {
    if (open) {
      reset(
        project
          ? { project_name: project.project_name, description: project.description ?? "", status: project.status }
          : { project_name: "", description: "", status: "ACTIVE" }
      );
    }
  }, [open, project, reset]);

  const onSubmit = async (values: FormValues) => {
    try {
      if (isEditing && project) {
        await updateMutation.mutateAsync({ id: project.project_id, payload: values });
        toast.success("Project updated");
      } else {
        await createMutation.mutateAsync(values);
        toast.success("Project created");
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
          <DialogTitle>{isEditing ? "Edit Project" : "New Project"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update this project's details." : "Add a new project to your organization."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="project_name">Project name</Label>
            <Input id="project_name" placeholder="Website Redesign" {...register("project_name")} />
            {errors.project_name && <p className="text-xs text-destructive">{errors.project_name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" placeholder="What is this project about?" {...register("description")} />
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replaceAll("_", " ")}
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
              {isEditing ? "Save changes" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
