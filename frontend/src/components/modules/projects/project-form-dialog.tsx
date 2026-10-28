"use client";

import { useEffect, useState } from "react";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORITY_LABEL, PROJECT_STATUSES, TASK_PRIORITIES } from "@/lib/constants";
import { useCreateProject, useProjectAssignment, useProjectAssignmentCandidates, useUpdateProject } from "@/hooks/queries/use-projects";
import { useUploadDocument } from "@/hooks/queries/use-documents";
import { usePermissions } from "@/hooks/use-permissions";
import { getApiErrorMessage } from "@/lib/api/client";
import type { Project } from "@/types/project";

const schema = z.object({
  project_name: z.string().trim().min(2, "Project name must have at least 2 characters").max(200, "Project name must be 200 characters or fewer"),
  description: z.string().optional(),
  status: z.enum(PROJECT_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  start_date: z.string().optional(),
  due_date: z.string().optional(),
  team_lead_user_id: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function ProjectFormDialog({ open, onOpenChange, project }: {
  open: boolean; onOpenChange: (open: boolean) => void; project?: Project | null;
}) {
  const isEditing = !!project;
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();
  const uploadMutation = useUploadDocument();
  const {
    data: assignmentCandidates = [],
    isLoading: assignmentCandidatesLoading,
    isError: assignmentCandidatesError,
    refetch: refetchAssignmentCandidates,
  } = useProjectAssignmentCandidates(open);
  const { data: currentAssignment, isLoading: currentAssignmentLoading, isError: currentAssignmentError, refetch: refetchCurrentAssignment } = useProjectAssignment(project?.project_id, open && isEditing);
  const { canUploadDocuments } = usePermissions();
  const [projectFile, setProjectFile] = useState<File | null>(null);
  const [selectedTeamMemberIds, setSelectedTeamMemberIds] = useState<string[]>([]);
  const isSaving = createMutation.isPending || updateMutation.isPending || uploadMutation.isPending;
  const { register, handleSubmit, control, reset, setError, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { project_name: "", description: "", status: "ACTIVE", priority: "MEDIUM", start_date: "", due_date: "", team_lead_user_id: "" },
  });

  useEffect(() => {
    if (!open) return;
    setProjectFile(null);
    setSelectedTeamMemberIds([]);
    reset(project ? {
      project_name: project.project_name, description: project.description ?? "", status: project.status,
      priority: project.priority ?? "MEDIUM", start_date: project.start_date ?? "", due_date: project.due_date ?? "",
      team_lead_user_id: "",
    } : {
      project_name: "", description: "", status: "ACTIVE", priority: "MEDIUM",
      start_date: "", due_date: "", team_lead_user_id: "",
    });
  }, [open, project, reset]);

  useEffect(() => {
    if (!open || !isEditing || !currentAssignment) return;
    setValue("team_lead_user_id", currentAssignment.team_lead_user_id ?? "");
    setSelectedTeamMemberIds(currentAssignment.team_member_user_ids ?? []);
  }, [open, isEditing, currentAssignment, setValue]);

  const onSubmit = async (values: FormValues) => {
    if (values.start_date && values.due_date && values.due_date < values.start_date) {
      setError("due_date", { message: "Due date must be on or after the start date" });
      return;
    }
    if (!values.team_lead_user_id) {
      setError("team_lead_user_id", { message: "Select a team lead" });
      return;
    }
    if (isEditing && (currentAssignmentLoading || currentAssignmentError || assignmentCandidatesLoading || assignmentCandidatesError)) {
      setError("root", { message: "Wait for the project team and eligible users to load, then try again." });
      return;
    }
    let createdId: string | null = null;
    try {
      const payload = {
        project_name: values.project_name,
        description: values.description || null,
        status: values.status,
        priority: values.priority,
        start_date: values.start_date || null,
        due_date: values.due_date || null,
      };
      if (isEditing && project) {
        await updateMutation.mutateAsync({ id: project.project_id, payload: {
          ...payload,
          team_lead_user_id: values.team_lead_user_id,
          team_member_user_ids: selectedTeamMemberIds,
        } });
        if (projectFile && canUploadDocuments) {
          try {
            await uploadMutation.mutateAsync({ project_id: project.project_id, title: projectFile.name, version: "1.0", file: projectFile });
          } catch (uploadError) {
            toast.error(`Project details were saved, but the file could not be uploaded: ${getApiErrorMessage(uploadError)}`);
          }
        }
        toast.success("Project updated");
      } else {
        const created = await createMutation.mutateAsync({
          ...payload,
          team_lead_user_id: values.team_lead_user_id!,
          team_member_user_ids: selectedTeamMemberIds,
        });
        createdId = created.project_id;
        toast.success("Project, team, and default workflow created");
        if (projectFile && canUploadDocuments) {
          try {
            await uploadMutation.mutateAsync({ project_id: created.project_id, title: projectFile.name, version: "1.0", file: projectFile });
          } catch (uploadError) {
            toast.error(`Project was created, but its file could not be uploaded: ${getApiErrorMessage(uploadError)}`);
          }
        }
      }
      onOpenChange(false);
    } catch (err) {
      if (createdId) {
        toast.error(`Project was created, but setup needs attention: ${getApiErrorMessage(err)}`);
        onOpenChange(false);
      } else {
        setError("root", { message: getApiErrorMessage(err) });
      }
    }
  };

  const selectableTeamLeads = assignmentCandidates.filter((user) =>
    (user.role_names ?? []).some((role) => role.trim().toLowerCase() === "team lead")
  );
  const selectedTeamLeadUserId = watch("team_lead_user_id");
  const selectableDevelopers = assignmentCandidates.filter((user) =>
    (user.role_names ?? []).some((role) => role.trim().toLowerCase() === "developer")
  );

  useEffect(() => {
    setSelectedTeamMemberIds((current) => current.filter((userId) => userId !== selectedTeamLeadUserId));
  }, [selectedTeamLeadUserId]);

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{isEditing ? "Edit Project" : "Create Project"}</DialogTitle>
        <DialogDescription>{isEditing ? "Update the project details, team assignments, or add a project file." : "Set up the project, assign its Team Lead and developers, and create its default board and workflow."}</DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="project_name">Project name</Label><Input id="project_name" placeholder="Website Redesign" required maxLength={200} aria-invalid={!!errors.project_name} {...register("project_name")} />{errors.project_name && <p className="text-xs text-destructive">{errors.project_name.message}</p>}</div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="description">Description</Label><Textarea id="description" placeholder="What is this project about?" {...register("description")} /></div>
          <div className="space-y-1.5"><Label htmlFor="project-start">Start date</Label><Input id="project-start" type="date" {...register("start_date")} /></div>
          <div className="space-y-1.5"><Label htmlFor="project-due">Target due date</Label><Input id="project-due" type="date" {...register("due_date")} />{errors.due_date && <p className="text-xs text-destructive">{errors.due_date.message}</p>}</div>
        </section>

        <section className="space-y-3 rounded-xl border p-4">
          <div><h3 className="text-sm font-semibold">Project assignment</h3><p className="text-xs text-muted-foreground">{isEditing ? "Update the Team Lead and developer members for this project." : "Choose the Team Lead and developers for this project."}</p></div>
          {isEditing && currentAssignmentError && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"><span>Could not load the current project team.</span><Button type="button" variant="outline" size="sm" className="h-7 border-rose-200 bg-white" onClick={() => void refetchCurrentAssignment()} disabled={currentAssignmentLoading}>Retry</Button></div>}
          {assignmentCandidatesError && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800"><span>Could not load project assignment users.</span><Button type="button" variant="outline" size="sm" className="h-7 border-rose-200 bg-white" onClick={() => void refetchAssignmentCandidates()} disabled={assignmentCandidatesLoading}>Retry</Button></div>}
          <div className="space-y-1.5"><Label>Team Lead <span className="text-destructive">*</span></Label><Controller control={control} name="team_lead_user_id" render={({ field }) => <Select value={field.value || ""} onValueChange={field.onChange}><SelectTrigger aria-invalid={!!errors.team_lead_user_id}><SelectValue placeholder="Choose team lead" /></SelectTrigger><SelectContent>{assignmentCandidatesLoading || currentAssignmentLoading ? <SelectItem value="__loading_team_leads__" disabled>Loading eligible users…</SelectItem> : assignmentCandidatesError ? <SelectItem value="__team_leads_error__" disabled>Could not load users</SelectItem> : selectableTeamLeads.length ? selectableTeamLeads.map((user) => <SelectItem key={user.user_id} value={user.user_id}>{user.name}</SelectItem>) : <SelectItem value="__no_team_leads__" disabled>No active users have the Team Lead role</SelectItem>}</SelectContent></Select>} />{errors.team_lead_user_id && <p className="text-xs text-destructive">{errors.team_lead_user_id.message}</p>}</div>
          <div className="space-y-2 sm:col-span-2">
            <div><Label>Developers <span className="font-normal text-muted-foreground">(optional)</span></Label><p className="mt-1 text-xs text-muted-foreground">Only active users with the Developer role are listed.</p></div>
            {assignmentCandidatesLoading || currentAssignmentLoading ? <p className="rounded-lg border p-3 text-sm text-muted-foreground">Loading developers…</p> : assignmentCandidatesError ? <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">Developer list is unavailable. Retry loading eligible users above.</p> : selectableDevelopers.some((user) => user.user_id !== selectedTeamLeadUserId) ? <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border p-2">
              {selectableDevelopers.filter((user) => user.user_id !== selectedTeamLeadUserId).map((user) => <div key={user.user_id} className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-slate-50">
                <Checkbox id={`project-developer-${user.user_id}`} checked={selectedTeamMemberIds.includes(user.user_id)} onCheckedChange={(checked) => setSelectedTeamMemberIds((current) => checked === true ? [...new Set([...current, user.user_id])] : current.filter((userId) => userId !== user.user_id))} />
                <Label htmlFor={`project-developer-${user.user_id}`} className="flex-1 cursor-pointer font-normal">{user.name}</Label>
              </div>)}
            </div> : <p className="rounded-lg border p-3 text-sm text-muted-foreground">No active developers are available to add.</p>}
            <p className="text-xs text-muted-foreground">{selectedTeamMemberIds.length} developer{selectedTeamMemberIds.length === 1 ? "" : "s"} selected</p>
          </div>
        </section>

        {canUploadDocuments && <section className="space-y-3 rounded-xl border p-4">
          <div><h3 className="text-sm font-semibold">Project file <span className="font-normal text-muted-foreground">(optional)</span></h3><p className="text-xs text-muted-foreground">Add a file to Project Resources.</p></div>
          <Input id="project-file" type="file" aria-label="Project file" onChange={(event) => setProjectFile(event.target.files?.[0] ?? null)} />
        </section>}
        <section className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Status</Label><Controller control={control} name="status" render={({ field }) => <Select value={field.value} onValueChange={field.onChange}><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger><SelectContent>{PROJECT_STATUSES.map((status) => <SelectItem key={status} value={status}>{status.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select>} /></div>
          <div className="space-y-1.5"><Label>Priority</Label><Controller control={control} name="priority" render={({ field }) => <Select value={field.value} onValueChange={field.onChange}><SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger><SelectContent>{TASK_PRIORITIES.map((priority) => <SelectItem key={priority} value={priority}>{PRIORITY_LABEL[priority]}</SelectItem>)}</SelectContent></Select>} /></div>
        </section>
        {errors.root && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{errors.root.message}</p>}
        <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={isSaving || (isEditing && (currentAssignmentLoading || currentAssignmentError || assignmentCandidatesLoading || assignmentCandidatesError))}>{isSaving && <Loader2 className="h-4 w-4 animate-spin" />}{isEditing ? "Save changes" : "Create project"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
