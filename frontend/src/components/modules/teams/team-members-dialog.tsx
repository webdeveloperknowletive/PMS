"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAddTeamMember, useRemoveTeamMember, useTeamMembers } from "@/hooks/queries/use-teams";
import { useUsers } from "@/hooks/queries/use-users";
import { getApiErrorMessage } from "@/lib/api/client";
import type { Team } from "@/types/team";

export function TeamMembersDialog({
  open,
  onOpenChange,
  team,
  canManage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: Team | null;
  canManage: boolean;
}) {
  const { data: members, isLoading } = useTeamMembers(team?.team_id);
  const { data: users } = useUsers();
  const addMember = useAddTeamMember();
  const removeMember = useRemoveTeamMember();

  const [selectedUserId, setSelectedUserId] = useState("");
  const [responsibility, setResponsibility] = useState("");

  if (!team) return null;

  const memberUserIds = new Set((members ?? []).map((m) => m.user_id));
  const availableUsers = (users ?? []).filter((u) => !memberUserIds.has(u.user_id));
  const userMap = new Map((users ?? []).map((u) => [u.user_id, u]));
  const atCapacity = (members?.length ?? 0) >= team.max_members;

  const handleAdd = async () => {
    if (!selectedUserId) return;
    try {
      await addMember.mutateAsync({
        teamId: team.team_id,
        userId: selectedUserId,
        responsibility: responsibility || undefined,
      });
      toast.success("Member added");
      setSelectedUserId("");
      setResponsibility("");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const handleRemove = async (memberId: string, name: string) => {
    try {
      await removeMember.mutateAsync({ teamId: team.team_id, memberId });
      toast.success(`${name} removed from team`);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{team.team_name} — Members</DialogTitle>
          <DialogDescription>
            {members?.length ?? 0} / {team.max_members} members
          </DialogDescription>
        </DialogHeader>

        {canManage && !atCapacity && (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <p className="text-xs font-medium text-muted-foreground">Add a member</p>
            <div className="flex gap-2">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleAdd} disabled={!selectedUserId || addMember.isPending}>
                {addMember.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Add
              </Button>
            </div>
            <Input
              placeholder="Responsibility (optional, e.g. Frontend Developer)"
              value={responsibility}
              onChange={(e) => setResponsibility(e.target.value)}
            />
          </div>
        )}
        {canManage && atCapacity && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            This team is at capacity ({team.max_members} members). Increase max members or remove someone to add more.
          </p>
        )}

        <div className="space-y-1">
          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading members...</p>
          ) : members?.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No members yet.</p>
          ) : (
            members?.map((m) => {
              const user = userMap.get(m.user_id);
              return (
                <div key={m.member_id} className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <UserAvatar user={user} />
                    {m.responsibility && <span className="text-xs text-muted-foreground">— {m.responsibility}</span>}
                  </div>
                  {canManage && <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleRemove(m.member_id, user?.name ?? "Member")}
                    disabled={removeMember.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
