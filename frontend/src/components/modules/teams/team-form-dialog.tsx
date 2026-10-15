"use client";

import { useEffect, useState } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
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
import { TEAM_STATUSES } from "@/lib/constants";
import { Checkbox } from "@/components/ui/checkbox";
import { useAddTeamMember, useCreateTeam, useRemoveTeamMember, useTeamLeads, useTeams, useTeamMembers, useUpdateTeam, useTeamMemberCandidates } from "@/hooks/queries/use-teams";
import { useProjects } from "@/hooks/queries/use-projects";
import { useAuthStore } from "@/store/auth-store";
import { getApiErrorMessage } from "@/lib/api/client";
import type { Team } from "@/types/team";

const schema = z.object({
  project_id: z.string().min(1, "Project is required"),
  team_name: z.string().trim().min(1, "Team name is required").max(150, "Team name must be 150 characters or fewer"),
  description: z.string().optional(),
  // The lead is inherited from the project's assignment when creating a team;
  // editing keeps the team's existing lead.
  lead_user_id: z.string().optional(),
  max_members: z.coerce.number().int().positive("Must be at least 1"),
  status: z.enum(TEAM_STATUSES),
});
type FormValues = z.infer<typeof schema>;

export function TeamFormDialog({
  open,
  onOpenChange,
  team,
  defaultProjectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team?: Team | null;
  defaultProjectId?: string;
}) {
  const isEditing = !!team;
  const { data: projects } = useProjects();
  const { data: memberCandidates = [], isLoading: candidatesLoading } = useTeamMemberCandidates();
  const { data: currentTeamMembers = [], isLoading: membersLoading } = useTeamMembers(team?.team_id);
  const { data: teamLeads } = useTeamLeads();
  const { data: teams } = useTeams();
  const currentUser = useAuthStore((state) => state.user);
  const createMutation = useCreateTeam();
  const updateMutation = useUpdateTeam();
  const addTeamMember = useAddTeamMember();
  const removeTeamMember = useRemoveTeamMember();
  const isSaving = createMutation.isPending || updateMutation.isPending || addTeamMember.isPending || removeTeamMember.isPending;
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

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
      team_name: "",
      description: "",
      lead_user_id: "",
      max_members: 10,
      status: "ACTIVE",
    },
  });
  const selectedLeadUserId = useWatch({ control, name: "lead_user_id" });
  const selectedProjectId = useWatch({ control, name: "project_id" });
  const selectedCapacity = Number(useWatch({ control, name: "max_members" })) || 0;
  const existingProjectTeams = (teams ?? []).filter((item) => item.project_id === selectedProjectId);
  const assignedProjectLead = isEditing
    ? selectedLeadUserId
    : teamLeads?.find((lead) => lead.team_lead_id === existingProjectTeams[0]?.team_lead_id)?.user_id ??
      (currentUser?.role_names?.some((role) => role.trim().toLowerCase() === "team lead") ? currentUser.user_id : "");
  const resolvedLeadUserId = selectedLeadUserId || assignedProjectLead;

  useEffect(() => {
    if (resolvedLeadUserId) {
      setSelectedMemberIds((memberIds) => memberIds.filter((id) => id !== resolvedLeadUserId));
    }
  }, [resolvedLeadUserId]);

  useEffect(() => {
    setSelectedMemberIds((memberIds) => memberIds.slice(0, selectedCapacity));
  }, [selectedCapacity]);

  useEffect(() => {
    if (open) {
      const existingLeadUserId = team ? teamLeads?.find((l) => l.team_lead_id === team.team_lead_id)?.user_id ?? "" : "";
      const eligibleMemberIds = new Set(memberCandidates.map((member) => member.user_id));
      setSelectedMemberIds(team
        ? currentTeamMembers.filter((member) => eligibleMemberIds.has(member.user_id)).map((member) => member.user_id)
        : []);
      reset(
        team
          ? {
              project_id: team.project_id,
              team_name: team.team_name,
              description: team.description ?? "",
              lead_user_id: existingLeadUserId,
              max_members: team.max_members,
              status: team.status as (typeof TEAM_STATUSES)[number],
            }
          : {
              project_id: defaultProjectId ?? "",
              team_name: "",
              description: "",
              lead_user_id: "",
              max_members: 10,
              status: "ACTIVE",
            }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, team, defaultProjectId, reset, teamLeads, currentTeamMembers, memberCandidates]);

  const onSubmit = async (values: FormValues) => {
    try {
      // New teams inherit the selected project's assigned Team Lead. Edits keep
      // the existing lead association.
      const teamLeadId = isEditing ? team?.team_lead_id : existingProjectTeams[0]?.team_lead_id;
      if (!teamLeadId) {
        setError("root", { message: "This project has no assigned Team Lead yet." });
        return;
      }
      const payload = {
        project_id: values.project_id,
        team_lead_id: teamLeadId,
        team_name: values.team_name,
        description: isEditing ? team?.description ?? null : null,
        max_members: values.max_members,
        status: values.status,
        ...(!isEditing ? { member_user_ids: selectedMemberIds } : {}),
      };

      if (isEditing && team) {
        await updateMutation.mutateAsync({ id: team.team_id, payload });
        const candidateIds = new Set(memberCandidates.map((member) => member.user_id));
        const currentEligibleMembers = currentTeamMembers.filter((member) => candidateIds.has(member.user_id));
        const selectedIds = new Set(selectedMemberIds);
        for (const member of currentEligibleMembers) {
          if (!selectedIds.has(member.user_id)) {
            await removeTeamMember.mutateAsync({ teamId: team.team_id, memberId: member.member_id });
          }
        }
        const existingIds = new Set(currentEligibleMembers.map((member) => member.user_id));
        for (const userId of selectedMemberIds) {
          if (!existingIds.has(userId)) {
            await addTeamMember.mutateAsync({ teamId: team.team_id, userId });
          }
        }
        toast.success("Team updated");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Team created");
      }
      onOpenChange(false);
    } catch (err) {
      setError("root", { message: getApiErrorMessage(err) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Team" : "New Team"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update this team's details." : "Create a new team for a project."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1.5">
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
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="team_name">Team name</Label>
            <Input id="team_name" placeholder="e.g. Frontend Team" maxLength={150} {...register("team_name")} />
            {errors.team_name && <p className="text-xs text-destructive">{errors.team_name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="max_members">Max members</Label>
              <Input id="max_members" type="number" min={1} {...register("max_members")} />
              {errors.max_members && <p className="text-xs text-destructive">{errors.max_members.message}</p>}
            </div>
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
                      {TEAM_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.charAt(0) + s.slice(1).toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Select Developers and Testers</Label>
                <span className="text-xs text-muted-foreground">
                  {selectedMemberIds.length} selected · capacity {selectedCapacity}
                </span>
              </div>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                {memberCandidates
                  .filter((user) => user.user_id !== resolvedLeadUserId)
                  .map((user) => {
                    const checked = selectedMemberIds.includes(user.user_id);
                    const atCapacity = selectedMemberIds.length >= selectedCapacity;
                    return (
                      <label key={user.user_id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                        <Checkbox
                          checked={checked}
                          disabled={!checked && atCapacity}
                          onCheckedChange={(isChecked) => {
                            setSelectedMemberIds((memberIds) =>
                              isChecked
                                ? memberIds.length < selectedCapacity && !memberIds.includes(user.user_id)
                                  ? [...memberIds, user.user_id]
                                  : memberIds
                                : memberIds.filter((id) => id !== user.user_id)
                            );
                            setError("root", { message: "" });
                          }}
                        />
                        <span className="min-w-0 flex-1 truncate">{user.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{user.role_names.filter((role) => ["developer", "tester"].includes(role.trim().toLowerCase())).join(", ")}</span>
                      </label>
                    );
                  })}
                {candidatesLoading || (isEditing && membersLoading) ? <p className="px-2 py-2 text-sm text-muted-foreground">Loading developers and testers…</p> : memberCandidates.filter((user) => user.user_id !== resolvedLeadUserId).length === 0 && (
                  <p className="px-2 py-2 text-sm text-muted-foreground">No active Developers or Testers are available.</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Choose up to the team capacity. The assigned Team Lead will be added automatically.
              </p>
            </div>

          {errors.root && (
            errors.root.message && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{errors.root.message}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || candidatesLoading || (isEditing && membersLoading)}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? "Save changes" : "Create team"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
