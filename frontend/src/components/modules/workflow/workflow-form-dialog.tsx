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
import { WORKFLOW_STATUSES, WORKFLOW_TYPES } from "@/lib/constants";
import { useCreateWorkflow, useUpdateWorkflow } from "@/hooks/queries/use-workflows";
import { useProjects } from "@/hooks/queries/use-projects";
import { useTeamLeads, usePromoteToTeamLead } from "@/hooks/queries/use-teams";
import { useUsers } from "@/hooks/queries/use-users";
import { getApiErrorMessage } from "@/lib/api/client";
import type { Workflow } from "@/types/workflow";

const schema = z.object({
  project_id: z.string().min(1, "Project is required"),
  workflow_name: z.string().min(2, "Workflow name is required"),
  description: z.string().optional(),
  workflow_type: z.string().min(1),
  lead_user_id: z.string().min(1, "Owner is required"),
  is_default: z.boolean(),
  status: z.enum(WORKFLOW_STATUSES),
});
type FormValues = z.infer<typeof schema>;

export function WorkflowFormDialog({
  open,
  onOpenChange,
  workflow,
  defaultProjectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflow?: Workflow | null;
  defaultProjectId?: string;
}) {
  const isEditing = !!workflow;
  const { data: projects } = useProjects();
  const { data: users } = useUsers();
  const { data: teamLeads } = useTeamLeads();
  const promoteToLead = usePromoteToTeamLead();
  const createMutation = useCreateWorkflow();
  const updateMutation = useUpdateWorkflow();
  const isSaving = createMutation.isPending || updateMutation.isPending || promoteToLead.isPending;

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
      workflow_name: "",
      description: "",
      workflow_type: WORKFLOW_TYPES[0],
      lead_user_id: "",
      is_default: false,
      status: "ACTIVE",
    },
  });

  useEffect(() => {
    if (open) {
      const existingLeadUserId = workflow
        ? teamLeads?.find((l) => l.team_lead_id === workflow.team_lead_id)?.user_id ?? ""
        : "";
      reset(
        workflow
          ? {
              project_id: workflow.project_id,
              workflow_name: workflow.workflow_name,
              description: workflow.description ?? "",
              workflow_type: workflow.workflow_type,
              lead_user_id: existingLeadUserId,
              is_default: workflow.is_default,
              status: workflow.status as (typeof WORKFLOW_STATUSES)[number],
            }
          : {
              project_id: defaultProjectId ?? "",
              workflow_name: "",
              description: "",
              workflow_type: WORKFLOW_TYPES[0],
              lead_user_id: "",
              is_default: false,
              status: "ACTIVE",
            }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workflow, defaultProjectId, reset, teamLeads]);

  const onSubmit = async (values: FormValues) => {
    try {
      const teamLead = await promoteToLead.mutateAsync(values.lead_user_id);

      const payload = {
        project_id: values.project_id,
        team_lead_id: teamLead.team_lead_id,
        workflow_name: values.workflow_name,
        description: values.description || null,
        workflow_type: values.workflow_type,
        is_default: values.is_default,
        status: values.status,
      };

      if (isEditing && workflow) {
        await updateMutation.mutateAsync({ id: workflow.workflow_id, payload });
        toast.success("Workflow updated");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Workflow created");
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
          <DialogTitle>{isEditing ? "Edit Workflow" : "New Workflow"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update this workflow's details." : "Define a new workflow for a project."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="workflow_name">Workflow name</Label>
            <Input id="workflow_name" placeholder="e.g. Bug Fixing Workflow" {...register("workflow_name")} />
            {errors.workflow_name && <p className="text-xs text-destructive">{errors.workflow_name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" placeholder="What is this workflow for?" {...register("description")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
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
              <Label>Workflow type</Label>
              <Controller
                control={control}
                name="workflow_type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WORKFLOW_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Owner</Label>
            <Controller
              control={control}
              name="lead_user_id"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select owner" />
                  </SelectTrigger>
                  <SelectContent>
                    {(users ?? []).map((u) => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.lead_user_id && <p className="text-xs text-destructive">{errors.lead_user_id.message}</p>}
            <p className="text-xs text-muted-foreground">
              Workflows are owned by a team lead — the selected user is promoted automatically if needed.
            </p>
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
                      {WORKFLOW_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.charAt(0) + s.slice(1).toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex items-end pb-2">
              <Controller
                control={control}
                name="is_default"
                render={({ field }) => (
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(!!v)} />
                    Set as default
                  </label>
                )}
              />
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
              {isEditing ? "Save changes" : "Create workflow"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}